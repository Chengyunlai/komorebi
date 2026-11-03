const mix = (a, b, w) => a.map((v, i) => v + (b[i] - v) * w);
const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const neg = q => q.map(v => -v);
const normalize = q => { const n = Math.hypot(...q); if (!(n > 0)) throw new TypeError('zero quaternion'); return q.map(v => v / n); };
const multiply = (a,b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const slerp = (a,b,w) => { let d=dot(a,b); if(d<0){b=neg(b);d=-d;} if(d>.9995)return normalize(mix(a,b,w)); const angle=Math.acos(Math.min(1,d)); return a.map((v,i)=>(v*Math.sin((1-w)*angle)+b[i]*Math.sin(w*angle))/Math.sin(angle)); };
function transform(value) {
  if (!value || !Array.isArray(value.position) || value.position.length!==3 || !value.position.every(Number.isFinite) || !Array.isArray(value.rotation) || value.rotation.length!==4 || !value.rotation.every(Number.isFinite)) throw new TypeError('each transform requires finite position[3] and rotation xyzw[4]');
  return {position:[...value.position],rotation:normalize(value.rotation)};
}
const state = v => v===true || v==='planted' || v?.state==='planted' ? 'planted' : v===false || v==='flight' || v?.state==='flight' ? 'flight' : 'unknown';
/** Both samplers use the same elapsed seconds in a shared coordinate frame.
 * No root matching, contact inference, planting constraint or IK is performed.
 * incomingAlignment, if supplied, applies world Y yaw and translation to root only;
 * joint transforms are assumed root-local, except a declared root.bone duplicate
 * which must equal root and is kept synchronized. Only joint-ID sets are checked;
 * hierarchy/parent compatibility remains the caller's responsibility. Contacts accept true/false/null or state objects.
 */
export function planMovingTransition({outgoing,incoming,duration,contactPolicy='strict',incomingAlignment}={}) {
  if(typeof outgoing!=='function'||typeof incoming!=='function'||!Number.isFinite(duration)||duration<=0) throw new TypeError('two samplers and positive duration required');
  if(!['strict','allow-transition'].includes(contactPolicy))throw new TypeError('unknown contact policy');
  if(incomingAlignment && (!Number.isFinite(incomingAlignment.yaw) || !Array.isArray(incomingAlignment.translation) || incomingAlignment.translation.length!==3 || !incomingAlignment.translation.every(Number.isFinite)))throw new TypeError('alignment requires finite yaw and translation[3]');
  let topology;
  let rootBone;
  let rootBoneInitialized=false;
  function read(fn,t,align=false) {
    const value=fn(t); if(!value?.joints || typeof value.joints!=='object')throw new TypeError('joints required');
    const ids=Object.keys(value.joints).sort(); if(topology && JSON.stringify(ids)!==JSON.stringify(topology))throw new TypeError('incompatible joint topology'); topology ??= ids;
    const bone=value.root?.bone;
    if(bone!==undefined && (typeof bone!=='string' || !ids.includes(bone)))throw new TypeError('root bone must identify an existing joint');
    if(rootBoneInitialized && bone!==rootBone)throw new TypeError('incompatible root bone identifiers');
    rootBone=bone;rootBoneInitialized=true;
    const root=transform(value.root), joints=Object.fromEntries(ids.map(id=>[id,transform(value.joints[id])]));
    if(bone!==undefined){root.bone=bone;const joint=joints[bone];if(joint.position.some((v,i)=>Math.abs(v-root.position[i])>1e-8) || Math.abs(dot(joint.rotation,root.rotation))<1-1e-8)throw new TypeError('root bone joint must duplicate root transform');}
    if(align && incomingAlignment){const {yaw,translation}=incomingAlignment,c=Math.cos(yaw),s=Math.sin(yaw),[x,y,z]=root.position;root.position=[c*x+s*z+translation[0],y+translation[1],-s*x+c*z+translation[2]];root.rotation=multiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],root.rotation);}
    if(bone!==undefined)joints[bone]={position:[...root.position],rotation:[...root.rotation]};
    return {root,joints,contacts:value.contacts||{}};
  }
  function pair(t){return [read(outgoing,t),read(incoming,t,true)];}
  function contacts(a,b){return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(id=>{const x=state(a[id]),y=state(b[id]);if(x!=='unknown'&&y!=='unknown'&&x!==y&&contactPolicy==='strict')throw new Error(`incompatible contact support: ${id}`);return [id,{state:x===y?x:'unknown'}];}));}
  function sample(t){if(!Number.isFinite(t)||t<0||t>duration)throw new RangeError('time outside transition window');const [a,b]=pair(t),u=t/duration,w=u*u*u*(10+u*(-15+6*u));const blend=(x,y)=>({position:mix(x.position,y.position,w),rotation:slerp(x.rotation,y.rotation,w)});const root=blend(a.root,b.root);if(rootBone!==undefined)root.bone=rootBone;return {root,joints:Object.fromEntries(topology.map(id=>[id,blend(a.joints[id],b.joints[id])])),contacts:contacts(a.contacts,b.contacts)};}
  // Validate endpoints immediately; all subsequently sampled frames are also checked.
  sample(0);sample(duration);
  function diagnoseBoundaries({step=Math.min(1e-4,duration/1000)}={}) {
    if(!Number.isFinite(step)||step<=0||step>duration/2)throw new RangeError('invalid diagnostic step');
    const velocity=(f,t0,t1)=>{const a=f(t0),b=f(t1),dt=t1-t0;let qb=b.root.rotation;if(dot(a.root.rotation,qb)<0)qb=neg(qb);let delta=normalize(multiply(qb,[-a.root.rotation[0],-a.root.rotation[1],-a.root.rotation[2],a.root.rotation[3]]));if(delta[3]<0)delta=neg(delta);const n=Math.hypot(...delta.slice(0,3)),angle=2*Math.atan2(n,delta[3]);return {linear:b.root.position.map((v,i)=>(v-a.root.position[i])/dt),angular:delta.slice(0,3).map(v=>n>1e-12?v*angle/n/dt:0)};};
    const boundary=(source,t0,t1)=>{const transition=velocity(sample,t0,t1),reference=velocity(source,t0,t1);return {transition,source:reference,error:{linear:transition.linear.map((v,i)=>v-reference.linear[i]),angular:transition.angular.map((v,i)=>v-reference.angular[i])}};};
    return {method:'one-sided finite differences; signed world angular velocity',step,start:boundary(t=>read(outgoing,t),0,step),end:boundary(t=>read(incoming,t,true),duration-step,duration)};
  }
  return {duration,alignment:incomingAlignment?'explicit':'already-aligned-required',sample,diagnoseBoundaries};
}
