const SIDES=['left','right']
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
const sub=(a,b)=>a.map((v,i)=>v-b[i])
const stats=a=>({max:a.length?Math.max(...a):null,p95:a.length?[...a].sort((a,b)=>a-b)[Math.floor((a.length-1)*.95)]:null})
const point=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)
const rotation=q=>q===undefined||(Array.isArray(q)&&q.length===4&&q.every(Number.isFinite)&&Number.isFinite(Math.hypot(...q))&&Math.hypot(...q)>0)
const angle=(a,b)=>{if(!a||!b)return null;return 2*Math.acos(Math.min(1,Math.abs(a.reduce((v,x,i)=>v+x*b[i],0)/(Math.hypot(...a)*Math.hypot(...b)))))}
const multiply=([x,y,z,w],[a,b,c,d])=>[w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c]
const normalize=q=>{const n=Math.hypot(...q);return q.map(v=>v/n)}
const inverse=q=>{const [x,y,z,w]=normalize(q);return [-x,-y,-z,w]}
const increment=(initial,current)=>initial&&current?multiply(normalize(current),inverse(initial)):null
const kind=e=>e?.state==='plant'?(e.knowledge==='annotated'?'annotatedPlant':e.knowledge==='estimated'?'estimatedPlant':null):null
/** Aggregate world ankle kinematics; no raw sample traces are returned. */
export function createFootWindowAssessment({sourceToTargetYaw=0,sourceMetresToTargetMetres=1,sourceToTargetRotation,maxGapSeconds=.1}={}){
 if(!Number.isFinite(sourceToTargetYaw)||!Number.isFinite(sourceMetresToTargetMetres)||sourceMetresToTargetMetres<=0||!Number.isFinite(maxGapSeconds)||maxGapSeconds<=0)throw new TypeError('Invalid foot assessment mapping')
 if(sourceToTargetRotation!==undefined&&!rotation(sourceToTargetRotation))throw new TypeError('Invalid source-to-target orientation quaternion')
 const c=Math.cos(sourceToTargetYaw),s=Math.sin(sourceToTargetYaw),align=p=>[(c*p[0]+s*p[2])*sourceMetresToTargetMetres,p[1]*sourceMetresToTargetMetres,(-s*p[0]+c*p[2])*sourceMetresToTargetMetres]
 const orientationBasis=sourceToTargetRotation?normalize(sourceToTargetRotation):[0,Math.sin(sourceToTargetYaw/2),0,Math.cos(sourceToTargetYaw/2)]
 const data=Object.fromEntries(SIDES.map(side=>[side,{sourcePath:0,targetPath:0,sourceY:[],targetY:[],sourceSpeed:[],targetSpeed:[],mismatch:[],orientation:[],windows:{annotatedPlant:[],estimatedPlant:[]},active:null}]))
 let first=null,last=null,count=0,gaps=0
 const close=d=>{if(d.active){d.windows[d.active.kind].push(d.active);d.active=null}}
 function push(input){
  if(!input||!Number.isFinite(input.time)||(last&&input.time<=last.time))throw new TypeError('Foot samples require strictly increasing finite times')
  for(const group of ['sourceFeet','targetFeet'])for(const side of SIDES){const f=input[group]?.[side];if(!f||!point(f.position)||!rotation(f.rotation))throw new TypeError('Invalid world ankle position or quaternion')}
  // Copy only after every field passes validation, so rejected pushes cannot change state.
  const sample={time:input.time,phase:input.phase??null,sourceFeet:{},targetFeet:{}}
  for(const group of ['sourceFeet','targetFeet'])for(const side of SIDES){const f=input[group][side];sample[group][side]={position:[...f.position],rotation:f.rotation&&[...f.rotation],evidence:f.evidence&&{...f.evidence}}}
  if(!first)first=sample
  const dt=last?sample.time-last.time:0,gap=!!last&&dt>maxGapSeconds
  if(gap)gaps++
  for(const side of SIDES){const d=data[side],sp=sample.sourceFeet[side].position,tp=sample.targetFeet[side].position
   d.sourceY.push(sp[1]);d.targetY.push(tp[1]);d.mismatch.push(dist(align(sub(sp,first.sourceFeet[side].position)),sub(tp,first.targetFeet[side].position)))
   const si=increment(first.sourceFeet[side].rotation,sample.sourceFeet[side].rotation),ti=increment(first.targetFeet[side].rotation,sample.targetFeet[side].rotation)
   if(si&&ti)d.orientation.push(angle(multiply(multiply(orientationBasis,si),inverse(orientationBasis)),ti))
   if(last&&!gap){const sd=dist(sp,last.sourceFeet[side].position),td=dist(tp,last.targetFeet[side].position);d.sourcePath+=sd;d.targetPath+=td;d.sourceSpeed.push(sd/dt);d.targetSpeed.push(td/dt)}
   const k=kind(sample.sourceFeet[side].evidence),provenance=sample.sourceFeet[side].evidence?.provenance??null
   if(d.active&&(gap||d.active.kind!==k||d.active.phase!==sample.phase||d.active.provenance!==provenance))close(d)
   if(k){if(!d.active)d.active={kind:k,phase:sample.phase??null,provenance,start:sample.time,end:sample.time,sampleCount:0,sourceAnchor:[...sp],targetAnchor:[...tp],sourceDriftMax:0,targetDriftMax:0,sourcePathLength:0,targetPathLength:0};const w=d.active;if(w.sampleCount&&last&&!gap){w.sourcePathLength+=dist(sp,last.sourceFeet[side].position);w.targetPathLength+=dist(tp,last.targetFeet[side].position)}w.end=sample.time;w.sampleCount++;w.sourceDriftMax=Math.max(w.sourceDriftMax,dist(sp,w.sourceAnchor));w.targetDriftMax=Math.max(w.targetDriftMax,dist(tp,w.targetAnchor))}
  }
  last=sample;count++;return api
 }
 function finish(){
  const perFoot={}
  for(const side of SIDES){const d=data[side],windows={};for(const k of ['annotatedPlant','estimatedPlant']){const all=[...d.windows[k],...(d.active?.kind===k?[d.active]:[])];windows[k]={count:all.length,sampleCount:all.reduce((n,w)=>n+w.sampleCount,0),sourceDriftMax:all.length?Math.max(...all.map(w=>w.sourceDriftMax)):null,targetDriftMax:all.length?Math.max(...all.map(w=>w.targetDriftMax)):null,windows:all.map(({sourceAnchor,targetAnchor,kind,...w})=>({...w}))}}
   perFoot[side]={source:{pathLength:d.sourcePath,displacement:count?dist(last.sourceFeet[side].position,first.sourceFeet[side].position):null,ankleY:{min:count?Math.min(...d.sourceY):null,max:count?Math.max(...d.sourceY):null},speed:stats(d.sourceSpeed)},target:{pathLength:d.targetPath,displacement:count?dist(last.targetFeet[side].position,first.targetFeet[side].position):null,ankleY:{min:count?Math.min(...d.targetY):null,max:count?Math.max(...d.targetY):null},speed:stats(d.targetSpeed)},alignedDisplacementMismatch:stats(d.mismatch),orientationChangeMismatchRadians:stats(d.orientation),contactWindows:windows}
  }
  return {schema:'foot-window-assessment/v1',sampleCount:count,gapCount:gaps,timeRange:count?{start:first.time,end:last.time}:null,units:{position:'metres',time:'seconds',speed:'metres/second',angle:'radians',sourceMetrics:'native source metres and metres/second',targetMetrics:'target metres and metres/second',alignedDisplacementMismatch:'target metres'},axes:'world coordinates, Y up; yaw rotates X/Z around +Y',mapping:{sourceToTargetYaw,sourceMetresToTargetMetres,sourceToTargetRotation:[...orientationBasis],maxGapSeconds},anchors:'each foot uses its own first-frame world position; contact drift uses each window entry position',perFoot,limitations:['Source path, displacement, height, speed and plant drift remain in native source metres; multiply by sourceMetresToTargetMetres before comparing their magnitudes to target metrics. Only aligned displacement mismatch applies that scale.','Orientation compares basis-conjugated world rotation increments (explicit sourceToTargetRotation, otherwise yaw) from each first-frame quaternion, ignoring initial bind twist.','Ankle positions only; no sole geometry, measured floor, force, or IK assessment.','Estimated plant windows are kinematic diagnostics, never trusted contact or foot slip errors.','Annotated plant drift reports source and target separately; it is not a sole-ground slip measurement.','Gaps omit path and velocity bridges and split contact windows.']}
 }
 const api={push,finish};return api
}
