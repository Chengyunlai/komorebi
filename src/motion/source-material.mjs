import {Matrix4,Quaternion,Vector3} from 'three'
import {captureSourceRecord} from './source-record.mjs'
import {skeletonAt} from '../motion-lab/bvh.mjs'

const q = values => new Quaternion().fromArray(values).normalize()
const mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t)
// Body-local angular velocity: log(inverse(q0) * q1) / dt, shortest arc.
export function signedAngularVelocity(a,b,dt){
 if(!Number.isFinite(dt)||dt<=0)throw Error('Angular velocity requires positive finite time')
 for(const values of [a,b])if(!Array.isArray(values)||values.length!==4||!values.every(Number.isFinite)||Math.hypot(...values)<1e-12)throw Error('Invalid quaternion')
 const delta=q(a).invert().multiply(q(b)).normalize()
 if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w)
 const length=Math.hypot(delta.x,delta.y,delta.z)
 if(length<1e-12)return [0,0,0]
 const scale=2*Math.atan2(length,delta.w)/(length*dt)
 return [delta.x*scale,delta.y*scale,delta.z*scale]
}

/** Source-only, full-frame material. Units are declared by the caller, never guessed. */
export function buildSourceMotionMaterial(bvh,{sourceId='bvh-source',metersPerUnit,provenance=null}={}){
 if(!Number.isFinite(metersPerUnit)||metersPerUnit<=0)throw Error('metersPerUnit must be explicitly positive and finite')
 if(!Number.isSafeInteger(bvh?.frameCount)||bvh.frameCount<1||!Number.isFinite(bvh.frameTime)||bvh.frameTime<=0||!bvh.joints?.length)throw Error('Invalid source frame count or time')
 const rig=bvh.joints.map((joint,i)=>({id:`${i}:${joint.name}`,name:joint.name,parent:joint.parent<0?null:`${joint.parent}:${bvh.joints[joint.parent].name}`}))
 const roots=rig.filter(j=>j.parent===null)
 if(roots.length!==1)throw Error('Source material requires one hierarchy root')
 const rootBone=roots[0].id
 const frames=Array.from({length:bvh.frameCount},(_,frame)=>{
  const time=frame*bvh.frameTime
  if(!Number.isFinite(time))throw Error('Invalid source frame time')
  const record=captureSourceRecord(bvh,time,{scaleToMetres:metersPerUnit,bodyId:sourceId}),sample=skeletonAt(bvh,time)
  const worldPositions=Object.fromEntries(rig.map((joint,i)=>[joint.id,sample.positions[i].map(v=>v*metersPerUnit)]))
  if(Object.values(worldPositions).some(v=>!v.every(Number.isFinite)))throw Error('Invalid source position')
  return {frame,time,joints:record.joints,worldPositions,root:{bone:rootBone,position:worldPositions[rootBone],rotation:record.joints[rootBone].rotation}}
 })
 // Use adjacent intervals, including a backward interval at the last frame.
 // No central averaging: reversal signs at a boundary remain observable.
 frames.forEach((frame,i)=>{
  const left=frames[i===frames.length-1?Math.max(0,i-1):i],right=frames[Math.min(frames.length-1,i+1)],dt=right.time-left.time
  for(const joint of rig)frame.joints[joint.id].angularVelocity=dt? signedAngularVelocity(left.joints[joint.id].rotation,right.joints[joint.id].rotation,dt):[0,0,0]
  frame.root.angularVelocity=frame.joints[rootBone].angularVelocity
  frame.root.linearVelocity=dt?right.root.position.map((v,k)=>(v-left.root.position[k])/dt):[0,0,0]
 })
 return {schema:'source-motion-material/v1',sourceId,provenance,metersPerUnit,
  coordinate:{unit:'metre',timeUnit:'second',quaternion:'xyzw',localSpace:'source-parent-local',rootSpace:'source-world',axes:'source axes preserved; no axis conversion',angularVelocitySpace:'joint-local/body',angularVelocityUnit:'radian/second',linearVelocityUnit:'metre/second',velocityTimeConvention:'piecewise source interval; forward except backward at final frame; not a smooth derivative'},
  rig,rootBones:{hierarchy:rootBone,anatomicalHips:rig.find(j=>/^hips$/i.test(j.name))?.id??null},
  frameTimes:frames.map(f=>f.time),frames,range:{start:0,end:frames.at(-1).time,duration:frames.at(-1).time},
  annotations:Object.fromEntries(['contacts','segments','music'].map(key=>[key,{status:'unknown',reason:'No source annotation supplied; not inferred from motion or beats'}]))}
}

export function sampleSourceMaterial(material,time){
 const {frames,range}=material
 if(!Number.isFinite(time)||time<range.start||time>range.end)throw Error('Sample time outside source range')
 let lo=0,hi=frames.length-1
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].time<=time)lo=mid;else hi=mid-1}
 const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],t=b.time===a.time?0:(time-a.time)/(b.time-a.time)
 const joints=Object.fromEntries(material.rig.map(({id})=>[id,{position:mix(a.joints[id].position,b.joints[id].position,t),rotation:q(a.joints[id].rotation).slerp(q(b.joints[id].rotation),t).toArray(),angularVelocity:a.joints[id].angularVelocity.slice()}]))
 const worlds={},worldPositions={}
 for(const {id,parent} of material.rig){
  const joint=joints[id],local=new Matrix4().compose(new Vector3().fromArray(joint.position),q(joint.rotation),new Vector3(1,1,1))
  worlds[id]=parent===null?local:worlds[parent].clone().multiply(local)
  worldPositions[id]=new Vector3().setFromMatrixPosition(worlds[id]).toArray()
 }
 return {time,sourceTime:time,frame:a.frame,nextFrame:b.frame,alpha:t,joints,worldPositions,root:{bone:a.root.bone,position:worldPositions[a.root.bone],rotation:joints[a.root.bone].rotation,linearVelocity:a.root.linearVelocity.slice(),angularVelocity:a.root.angularVelocity.slice()}}
}

export function describeSourceMaterialBoundary(material,boundary){
 if(!['start','end'].includes(boundary))throw Error('Boundary must be start or end')
 return {boundary,velocityConvention:'one-sided source interval; signed joint-local radians/second and world metres/second',...sampleSourceMaterial(material,material.range[boundary])}
}
