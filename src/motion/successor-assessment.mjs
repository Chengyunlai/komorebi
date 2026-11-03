import {Matrix4,Quaternion,Vector3} from 'three'
import {sampleSourceMaterial,signedAngularVelocity} from './source-material.mjs'
import {estimatePlanarAlignment,applyPlanarAlignment} from './planar-alignment.mjs'
import {sourcePoseToSkeleton} from './material-skeleton.mjs'

export const DEFAULT_SUCCESSOR_LIMITS=Object.freeze({poseRmsRotationGap:.65,hipsVelocityGap:1.5,angularVelocityRmsGap:4,heightDifference:.25})
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
const rms=values=>Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length)
const worldRotations=(material,pose)=>sourcePoseToSkeleton(material,pose).matrices.map(values=>new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(values).transpose()).normalize())
function interval(material,time){
 const times=material.frameTimes??material.frames.map(f=>f.time)
 let i=0;while(i<times.length-1&&times[i+1]<=time)i++
 if(i===times.length-1)i--
 if(i<0||!(times[i+1]>times[i]))throw Error('Velocity requires two distinct source frame times')
 return [times[i],times[i+1]]
}
function boundary(material,time,alignment){
 const [a,b]=interval(material,time),dt=b-a
 const raw=[a,b].map(t=>sampleSourceMaterial(material,t))
 const poses=alignment?raw.map(p=>applyPlanarAlignment(material,p,alignment)):raw
 const index=material.rig.findIndex(j=>j.id===material.rootBones.anatomicalHips)
 if(index<0)throw Error('Missing anatomical hips')
 const hips=poses.map(p=>sourcePoseToSkeleton(material,p).positions[index].map(v=>v*material.metersPerUnit))
 const rotations=poses.map(p=>worldRotations(material,p))
 // signedAngularVelocity yields body-local vectors. Rotate that log by the
 // first world orientation to obtain the equivalent q1 * inverse(q0) world log.
 const angular=Object.fromEntries(material.rig.map(({id},i)=>[id,new Vector3(...signedAngularVelocity(rotations[0][i].toArray(),rotations[1][i].toArray(),dt)).applyQuaternion(rotations[0][i]).toArray()]))
 return {hipsVelocity:hips[1].map((v,i)=>(v-hips[0][i])/dt),angular,interval:[a,b]}
}
const unknown=()=>({state:'unknown',knowledge:'unknown'})
/** Boundary screening only: numerical limits are engineering assumptions, not
 * proof of an entire blend's viability or physical/contact correctness. */
export function assessMotionSuccessor(material,{outgoingTime,incomingTime,duration=.5,contacts,limits={}}={}){
 const resolved={...DEFAULT_SUCCESSOR_LIMITS,...limits},reasons=[]
 const result={status:'rejected',reasons,metrics:null,alignment:null,contactEvidence:null,limits:resolved,cost:Infinity,provenance:{scope:'boundary-only; no full transition trajectory viability check',limits:'configurable engineering defaults; not learned dance thresholds',angularVelocity:'signed anatomical world angular vector difference after incoming alignment; FK quaternion finite difference on adjacent source interval',linearVelocity:'anatomical hips source-world finite difference, incoming rotated by fixed planar alignment; metre/second',pose:'world quaternion shortest-arc RMS after planar alignment; auxiliary hierarchy root and End Site joints excluded'}}
 try{
  if(Object.values(resolved).some(v=>!Number.isFinite(v)||v<=0))throw Error('Limits must be positive finite numbers')
  if(!Number.isFinite(duration)||duration<=0)throw Error('Duration must be positive and finite')
  for(const [name,time] of Object.entries({outgoingTime,incomingTime}))if(!Number.isFinite(time)||time<material.range.start||time+duration>material.range.end)throw Error(`${name} window outside source range`)
  const out=sampleSourceMaterial(material,outgoingTime),incoming=sampleSourceMaterial(material,incomingTime)
  const alignment=estimatePlanarAlignment(material,out,incoming),aligned=applyPlanarAlignment(material,incoming,alignment)
  const a=boundary(material,outgoingTime),b=boundary(material,incomingTime,alignment)
  const joints=material.rig.filter(j=>!(j.id===material.rootBones.hierarchy&&j.id!==material.rootBones.anatomicalHips)&&!/^end(?:\s|_|$)|end\s*site/i.test(j.name))
  if(!joints.length)throw Error('No joints available for boundary comparison')
  const outWorld=worldRotations(material,out),inWorld=worldRotations(material,aligned)
  const metrics={poseRmsRotationGap:rms(joints.map(({id})=>{const index=material.rig.findIndex(j=>j.id===id);return outWorld[index].angleTo(inWorld[index])})),hipsVelocityGap:distance(a.hipsVelocity,b.hipsVelocity),angularVelocityRmsGap:rms(joints.map(({id})=>distance(a.angular[id],b.angular[id]))),heightDifference:Math.abs(alignment.diagnostics.heightDifference),outgoingHipsVelocity:a.hipsVelocity,incomingAlignedHipsVelocity:b.hipsVelocity,jointCount:joints.length}
  Object.assign(result,{metrics,alignment,cost:Object.keys(DEFAULT_SUCCESSOR_LIMITS).reduce((sum,key)=>sum+metrics[key]/resolved[key],0)})
  result.provenance.velocityIntervals={outgoing:a.interval,incoming:b.interval}
  for(const key of Object.keys(DEFAULT_SUCCESSOR_LIMITS))if(metrics[key]>resolved[key])reasons.push(`${key} exceeds limit (${metrics[key]} > ${resolved[key]})`)
  const outgoing=contacts?.sample?.(outgoingTime)??{},next=contacts?.sample?.(incomingTime)??{}
  let annotated=true
  const feet={}
  for(const side of ['left','right']){
   const from=outgoing[side]??unknown(),to=next[side]??unknown()
   feet[side]={outgoing:from,incoming:to}
   const known=[from,to].every(v=>v.knowledge==='annotated'&&['plant','slide','lift','flight'].includes(v.state))
   if(!known){annotated=false;reasons.push(`${side} contact requires review: estimated or unknown evidence`)}
   else if(from.state!==to.state)reasons.push(`${side} annotated contact mismatch: ${from.state} → ${to.state}`)
  }
  result.contactEvidence={...feet,provenance:contacts?.provenance??contacts?.diagnostics??{method:'Per-foot sample evidence; inspect outgoing/incoming provenance',available:Boolean(contacts?.sample)}}
  const failed=Object.keys(DEFAULT_SUCCESSOR_LIMITS).some(key=>metrics[key]>resolved[key])||reasons.some(r=>r.includes('annotated contact mismatch'))
  result.status=failed?'rejected':annotated?'eligible':'review'
 }catch(error){reasons.push(error.message)}
 return result
}
export function rankMotionSuccessors(material,{outgoingTime,candidates,duration=.5,contacts,limits}={}){
 if(!Array.isArray(candidates)||!candidates.length)throw Error('No successor candidates supplied; no fallback')
 const order={eligible:0,review:1,rejected:2}
 return candidates.map(({id,time})=>({...assessMotionSuccessor(material,{outgoingTime,incomingTime:time,duration,contacts,limits}),id,time})).sort((a,b)=>order[a.status]-order[b.status]||a.cost-b.cost||String(a.id).localeCompare(String(b.id)))
}
