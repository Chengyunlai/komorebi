import {Quaternion,Vector3} from 'three'
import {sourcePoseToSkeleton} from './material-skeleton.mjs'

const wrap = angle => Math.atan2(Math.sin(angle),Math.cos(angle))
const rotate = (values,yaw) => new Vector3(...values).applyAxisAngle(new Vector3(0,1,0),yaw).toArray()
function worlds(material,pose){
 const skeleton=sourcePoseToSkeleton(material,pose)
 return Object.fromEntries(material.rig.map(({id},i)=>[id,skeleton.positions[i].map(v=>v*material.metersPerUnit)]))
}
function landmarks(material,pose){
 const hips=material.rootBones?.anatomicalHips
 const left=material.rig.find(j=>j.name==='UpperLeg_L')?.id,right=material.rig.find(j=>j.name==='UpperLeg_R')?.id
 if(!hips||!material.rig.some(j=>j.id===hips)||!left||!right)throw Error('Planar alignment requires explicit anatomical hips and UpperLeg_L/UpperLeg_R; no heading guess')
 const positions=worlds(material,pose),a=positions[left],b=positions[right],dx=a[0]-b[0],dz=a[2]-b[2]
 if(Math.hypot(dx,dz)<1e-8)throw Error('Degenerate UpperLeg_L/UpperLeg_R planar heading')
 return {hips:positions[hips],heading:Math.atan2(-dz,dx),hipsBone:hips,leftBone:left,rightBone:right}
}
/** Fixed incoming-to-outgoing rigid transform. Y-up is an explicit experiment
 * assumption; all positions are metres and yaw is radians about positive Y. */
export function estimatePlanarAlignment(material,outgoingPose,incomingPose){
 const outgoing=landmarks(material,outgoingPose),incoming=landmarks(material,incomingPose)
 const yaw=wrap(outgoing.heading-incoming.heading),rotated=rotate(incoming.hips,yaw)
 const translation=[outgoing.hips[0]-rotated[0],0,outgoing.hips[2]-rotated[2]]
 const beforePlanarSeparation=Math.hypot(outgoing.hips[0]-incoming.hips[0],outgoing.hips[2]-incoming.hips[2])
 const afterPlanarSeparation=Math.hypot(outgoing.hips[0]-rotated[0]-translation[0],outgoing.hips[2]-rotated[2]-translation[2])
 const headingErrorBefore=wrap(outgoing.heading-incoming.heading),headingErrorAfter=wrap(outgoing.heading-incoming.heading-yaw)
 return {yaw,translation,diagnostics:{beforePlanarSeparation,afterPlanarSeparation,headingError:headingErrorAfter,headingErrorBefore,headingErrorAfter,heightDifference:incoming.hips[1]-outgoing.hips[1],outgoingSourceTime:outgoingPose.sourceTime??outgoingPose.time,incomingSourceTime:incomingPose.sourceTime??incomingPose.time,provenance:{method:'world UpperLeg_L minus UpperLeg_R projected to XZ; anatomical hips position',axes:'source Y-up assumed explicitly; yaw about +Y; no axis conversion',positionUnit:'metre',angleUnit:'radian',hipsBone:outgoing.hipsBone,leftBone:outgoing.leftBone,rightBone:outgoing.rightBone,contacts:'unknown; no contact inference or IK'}}}
}

export function applyPlanarAlignment(material,pose,alignment){
 const {yaw,translation}=alignment??{}
 if(!Number.isFinite(yaw)||!Array.isArray(translation)||translation.length!==3||!translation.every(Number.isFinite)||translation[1]!==0)throw Error('Planar alignment requires finite yaw and [x,0,z] translation')
 // Validate duplicate root and hierarchy before changing either copy.
 worlds(material,pose)
 const rootId=material.rootBones?.hierarchy,root=pose.joints[rootId]
 if(!root||material.rig.find(j=>j.id===rootId)?.parent!==null)throw Error('Planar alignment requires explicit hierarchy root')
 const result=structuredClone(pose),transformed=result.joints[rootId]
 transformed.position=rotate(root.position,yaw).map((v,i)=>v+translation[i])
 transformed.rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw).multiply(new Quaternion().fromArray(root.rotation).normalize()).normalize().toArray()
 if(result.root){
  result.root.position=transformed.position.slice();result.root.rotation=transformed.rotation.slice()
  if(result.root.linearVelocity)result.root.linearVelocity=rotate(result.root.linearVelocity,yaw)
 }
 result.worldPositions=worlds(material,result)
 return result
}
