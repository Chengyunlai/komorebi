const SIDES = ['left', 'right']
const STATES = ['plant', 'slide', 'lift', 'flight', 'unknown']
const point = p => p != null && p.length >= 3 && [p[0], p[1], p[2]].every(Number.isFinite)
const quantile = (values, q) => values.length ? [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)] : null
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])

/** Offline source ankle kinematics. No sole geometry, floor, force, or IK is inferred. */
export function buildSourceContactEvidence(material, {annotations=[]}={}) {
 const frames=material?.frames ?? [], rig=material?.rig ?? []
 const start=material?.range?.start ?? frames[0]?.time ?? 0, end=material?.range?.end ?? frames.at(-1)?.time ?? start
 const bones={left:rig.find(b=>b.name==='Foot_L')?.id,right:rig.find(b=>b.name==='Foot_R')?.id,hips:rig.find(b=>b.name==='Hips')?.id}
 if(!Array.isArray(annotations))throw new TypeError('Contact annotations must be an array')
 const intervals=annotations.map(a=>{
  if(!a || !SIDES.includes(a.side) || !STATES.includes(a.state) || typeof a.source!=='string' || !a.source.trim() || a.source.trim().toLowerCase()==='unknown' || !Number.isFinite(a.start) || !Number.isFinite(a.end) || a.start<start || a.end>end || a.start>=a.end)throw new TypeError('Invalid contact annotation: require in-range interval, side, state and known source')
  return {...a,source:a.source.trim()}
 }).sort((a,b)=>a.start-b.start)
 for(const side of SIDES){const own=intervals.filter(a=>a.side===side);for(let i=1;i<own.length;i++)if(own[i].start<own[i-1].end)throw new TypeError('Contact annotation intervals must not overlap on the same side')}
 const positions=frames.map(f=>Object.fromEntries(SIDES.map(side=>[side,point(f.worldPositions?.[bones[side]])?Array.from(f.worldPositions[bones[side]]).slice(0,3):null])))
 const lowAnkleReference=quantile(positions.flatMap(p=>SIDES.flatMap(s=>p[s]?[p[s][1]]:[])),.08)
 const scales=frames.flatMap((f,i)=>point(f.worldPositions?.[bones.hips])?SIDES.flatMap(s=>positions[i][s]?[Math.abs(f.worldPositions[bones.hips][1]-positions[i][s][1])]:[]):[]).filter(v=>v>.05)
 const measuredScale=quantile(scales,.5), legScale=measuredScale??.8
 const thresholds={lowHeight:Math.max(.008,legScale*.035),liftHeight:Math.max(.008,legScale*.035)*1.8,stableSpeed:Math.max(.06,legScale*.22)}
 const evidence=frames.map((f,i)=>{
  const feet=Object.fromEntries(SIDES.map(side=>{
   const p=positions[i][side], j=i===frames.length-1?i-1:i+1, neighbor=positions[j]?.[side], dt=Math.abs(frames[j]?.time-f.time)
   const height=p&&lowAnkleReference!==null?p[1]-lowAnkleReference:null
   const speed=p&&neighbor&&Number.isFinite(dt)&&dt>0?distance(p,neighbor)/dt:null
   let state='unknown'
   if(height!==null&&speed!==null&&point(f.worldPositions?.[bones.hips]))state=height<=thresholds.lowHeight?(speed<=thresholds.stableSpeed?'plant':'slide'):height>thresholds.liftHeight?'lift':'unknown'
   return [side,{state,knowledge:state==='unknown'?'unknown':'estimated',provenance:state==='unknown'?'insufficient-or-ambiguous-kinematics':'source-world-ankle-kinematics',confidence:state==='unknown'?0:.5,height,speed,trustedContact:false}]
  }))
  return {time:f.time,...feet,feet}
 })
 function sample(time){
  if(!Number.isFinite(time)||time<start||time>end)throw new RangeError('Contact sample time outside source range')
  let index=0;while(index+1<evidence.length&&evidence[index+1].time<=time)index++
  const feet=Object.fromEntries(SIDES.map(side=>{
   const estimate=evidence[index]?.feet[side]??{state:'unknown',knowledge:'unknown',provenance:'insufficient-kinematics',confidence:0,height:null,speed:null,trustedContact:false}
   const annotation=intervals.find(a=>a.side===side&&time>=a.start&&(time<a.end||(time===end&&a.end===end)))
   return [side,annotation?{...estimate,state:annotation.state,knowledge:annotation.state==='unknown'?'unknown':'annotated',provenance:annotation.source,confidence:annotation.state==='unknown'?0:1,trustedContact:annotation.state==='plant'}:{...estimate}]
  }))
  return {time,...feet,feet}
 }
 return {schema:'source-contact-evidence/v1',sample,frames:evidence,annotations:intervals,diagnostics:{method:'kinematic-estimate-with-explicit-annotation-overrides',bones,lowAnkleReference,legScale,scaleSource:measuredScale===null?'fallback':'hips-to-ankles',thresholds,annotationCount:intervals.length,assumptions:['world positions are valid FK in metres with Y up','shared low ankle reference is not a measured floor','ankle height and full 3D adjacent-interval speed only','plant and slide are estimates, not sole-ground contact or force','estimated states must not drive trusted hard contact decisions','flight is only available through explicit annotation','sample holds the preceding source frame; intervals are half-open except the final endpoint']}}
}
