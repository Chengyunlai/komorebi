import {Quaternion,Matrix4,Vector3} from 'three'
import {skeletonAt} from './bvh.mjs'
import {createVRMRetarget,validateRetargetFrame} from './vrm-retarget.mjs'
import {capturePoseRecord,applyPoseRecord} from '../motion/motion-record.mjs'
export const ROTATION_MAP={hips:'Hips',spine:'Spine',chest:'Chest',neck:'Neck',head:'Head',leftShoulder:'Shoulder_L',rightShoulder:'Shoulder_R',leftUpperArm:'UpperArm_L',leftLowerArm:'LowerArm_L',leftHand:'Hand_L',rightUpperArm:'UpperArm_R',rightLowerArm:'LowerArm_R',rightHand:'Hand_R',leftUpperLeg:'UpperLeg_L',leftLowerLeg:'LowerLeg_L',leftFoot:'Foot_L',leftToes:'Toes_L',rightUpperLeg:'UpperLeg_R',rightLowerLeg:'LowerLeg_R',rightFoot:'Foot_R',rightToes:'Toes_R'};
const worldQuaternion=matrix=>new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(matrix).transpose()).normalize();
function twistAngle(rotation,axis){const vector=new Vector3(rotation.x,rotation.y,rotation.z),projection=vector.dot(axis);if(Math.hypot(projection,rotation.w)<1e-8)return null;const angle=2*Math.atan2(projection,rotation.w);return Math.atan2(Math.sin(angle),Math.cos(angle))}
/** Transfer full world-rotation changes about a direction-aligned first-motion reference. */
export function createVRMRotationRetarget(vrm,bvh,options={}){
 const direction=createVRMRetarget(vrm,bvh,options),index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i])),saved=capturePoseRecord(vrm),first=skeletonAt(bvh,0),conversion=new Quaternion().fromArray(direction.sourceToTargetRotation),inverseConversion=conversion.clone().invert(),mapped=[];
 direction.apply(0);vrm.scene.updateMatrixWorld(true);
 for(const [name,source] of Object.entries(ROTATION_MAP)){
  const bone=vrm.humanoid.getNormalizedBoneNode(name),sourceIndex=index[source];if(!bone||sourceIndex===undefined)continue;
  if(!bvh.joints[sourceIndex].channels.some(c=>c.endsWith('rotation')))continue;
  const terminal=['hips','head','leftHand','rightHand','leftToes','rightToes'].includes(name);
  const child=terminal?null:bone.children.find(c=>c.position.length()>.0001);
  mapped.push({name,source,sourceIndex,bone,initialInverse:worldQuaternion(first.matrices[sourceIndex]).invert(),baseline:bone.getWorldQuaternion(new Quaternion()),axis:child?child.position.clone().normalize():null});
 }
 applyPoseRecord(vrm,saved);
 const available=mapped.some(b=>b.name==='hips')&&mapped.length>=8;
 // Set parents before children even when optional target bones change the hierarchy.
 const depth=bone=>{let n=0;for(let p=bone.parent;p;p=p.parent)n++;return n};mapped.sort((a,b)=>depth(a.bone)-depth(b.bone));
 function targets(frame){return mapped.map(b=>({bone:b,world:conversion.clone().multiply(worldQuaternion(frame.matrices[b.sourceIndex])).multiply(b.initialInverse).multiply(inverseConversion).multiply(b.baseline).normalize()}))}
 function measure(time){return measureFrame(skeletonAt(bvh,time))}
 function measureFrame(frame){validateRetargetFrame(frame,bvh.joints.length,{requireMatrices:true});if(!available)return {available:false,reason:'source lacks sufficient rotation channels'};vrm.scene.updateMatrixWorld(true);const perBone={};for(const {bone:b,world} of targets(frame)){const actual=b.bone.getWorldQuaternion(new Quaternion()),difference=world.clone().invert().multiply(actual).normalize(),twist=b.axis?twistAngle(difference,b.axis):null;perBone[b.name]={angularRadians:actual.angleTo(world),twistRadians:twist===null?null:Math.abs(twist)}}
  return {available:true,perBone,maxRadians:Math.max(0,...Object.values(perBone).map(b=>b.angularRadians)),maxTwistRadians:Math.max(0,...Object.values(perBone).map(b=>b.twistRadians||0)),scope:'against first-motion calibrated source world rotations; not an absolute bind-pose or skinning error'};
 }
 function apply(time){return applyFrame(skeletonAt(bvh,time))}
 function applyFrame(frame){if(!available)throw Error('源运动缺少足够旋转通道，不能启用校准旋转映射');validateRetargetFrame(frame,bvh.joints.length,{requireMatrices:true});const desired=targets(frame),report=direction.applyFrame(frame);for(const {bone:b,world} of desired){const parent=b.bone.parent.getWorldQuaternion(new Quaternion());b.bone.quaternion.copy(parent.invert().multiply(world)).normalize();b.bone.updateWorldMatrix(false,true)}return {...report,bones:mapped.length,rotationResidual:measureFrame(frame)}}
 return {apply,applyFrame,measure,measureFrame,available,scale:direction.scale,sourceToTargetRotation:direction.sourceToTargetRotation.slice(),mappedBones:mapped.map(b=>b.name),calibration:{sourceTime:0,method:'direction-aligned first-motion pose, then conjugated source world-rotation delta',formula:'Tj(t) = C Sj(t) inverse(Sj(0)) inverse(C) Bj(0)',absoluteInitialTwist:'unknown; inherited from target calibration',mapped:mapped.map(({name,source})=>({name,source}))}};
}
