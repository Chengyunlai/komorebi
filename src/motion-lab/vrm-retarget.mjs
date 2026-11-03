import {Vector3,Quaternion,Matrix4,Matrix3} from 'three'
import {skeletonAt} from './bvh.mjs'
export const VRM_LINKS=[['spine','Spine','Chest'],['chest','Chest','Neck'],['neck','Neck','Head'],['leftUpperArm','UpperArm_L','LowerArm_L'],['leftLowerArm','LowerArm_L','Hand_L'],['rightUpperArm','UpperArm_R','LowerArm_R'],['rightLowerArm','LowerArm_R','Hand_R'],['leftUpperLeg','UpperLeg_L','LowerLeg_L'],['leftLowerLeg','LowerLeg_L','Foot_L'],['leftFoot','Foot_L','Toes_L'],['rightUpperLeg','UpperLeg_R','LowerLeg_R'],['rightLowerLeg','LowerLeg_R','Foot_R'],['rightFoot','Foot_R','Toes_R']]
const v=p=>new Vector3(...p)
/** Sampled FK uses BVH joint order, XYZ positions and row-major world matrices. */
export function validateRetargetFrame(sample,jointCount,{requireMatrices=false}={}){
 const finiteArray=(value,size)=>value!=null&&value.length===size&&Array.from(value).every(Number.isFinite);
 if(!sample||!Number.isFinite(sample.frame)||!Array.isArray(sample.positions)||sample.positions.length!==jointCount||!Array.from(sample.positions).every(p=>finiteArray(p,3)))throw Error('Invalid sampled skeleton frame positions or frame');
 if((requireMatrices||sample.matrices!==undefined)&&(!Array.isArray(sample.matrices)||sample.matrices.length!==jointCount||!Array.from(sample.matrices).every(m=>finiteArray(m,16))))throw Error('Invalid sampled skeleton frame matrices');
 return sample;
}
function basis(x,up){x=x.clone().normalize();const z=new Vector3().crossVectors(x,up).normalize(),y=new Vector3().crossVectors(z,x).normalize();return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z))}
/** Geometry adapter: source joint directions -> normalized VRM bones. No music policy here. */
export function createVRMRetarget(vrm,bvh,{balanceMotion=false,rootMode=balanceMotion?'balance':'height',worldAlignment='body-basis'}={}){
 if(!['height','source','balance'].includes(rootMode))throw Error('未知根运动策略');
 if(!['body-basis','y-up'].includes(worldAlignment))throw Error('未知世界坐标对齐策略');
 const index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i]));
 for(const name of ['Hips','Spine','UpperLeg_L','UpperLeg_R',...VRM_LINKS.flatMap(l=>l.slice(1))])if(index[name]===undefined)throw Error('舞蹈参考缺少关节：'+name)
 const node=name=>vrm.humanoid.getNormalizedBoneNode(name),first=skeletonAt(bvh,0).positions;
 const sourceBasis=positions=>basis(v(positions[index.UpperLeg_L]).sub(v(positions[index.UpperLeg_R])),v(positions[index.Spine]).sub(v(positions[index.Hips])));
 const sourceInverse=sourceBasis(first).invert();vrm.scene.updateMatrixWorld(true);
 const targetBasis=basis(node('leftUpperLeg').getWorldPosition(new Vector3()).sub(node('rightUpperLeg').getWorldPosition(new Vector3())),node('spine').getWorldPosition(new Vector3()).sub(node('hips').getWorldPosition(new Vector3())));
 const sourceRight=v(first[index.UpperLeg_L]).sub(v(first[index.UpperLeg_R]));sourceRight.y=0;
 const targetRight=node('leftUpperLeg').getWorldPosition(new Vector3()).sub(node('rightUpperLeg').getWorldPosition(new Vector3()));targetRight.y=0;
 const rootConversion=new Quaternion().setFromUnitVectors(sourceRight.normalize(),targetRight.normalize());
 // Gravity-preserving alignment retains first-frame lean instead of absorbing it into C.
 const conversion=worldAlignment==='y-up'?rootConversion.clone():targetBasis.clone().multiply(sourceInverse),hips=node('hips'),hipsRest=hips.position.clone(),hipsWorldRest=hips.getWorldQuaternion(new Quaternion());
 const targetRest={};
 for(const [name] of VRM_LINKS){const bone=node(name);if(!bone)continue;const child=bone.children.find(c=>c.isObject3D&&c.position.length()>.0001);if(!child)continue;targetRest[name]={bone,quaternion:bone.getWorldQuaternion(new Quaternion()),direction:child.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3())).normalize()}}
 const sourceLeg=v(first[index.UpperLeg_L]).distanceTo(v(first[index.LowerLeg_L]))+v(first[index.LowerLeg_L]).distanceTo(v(first[index.Foot_L]));
 const targetLeg=node('leftUpperLeg').getWorldPosition(new Vector3()).distanceTo(node('leftLowerLeg').getWorldPosition(new Vector3()))+node('leftLowerLeg').getWorldPosition(new Vector3()).distanceTo(node('leftFoot').getWorldPosition(new Vector3()));
 const scale=targetLeg/sourceLeg;let lastFrame=-1;
 function apply(time){return applyFrame(skeletonAt(bvh,time))}
 function applyFrame(sample){
  const {positions,frame}=validateRetargetFrame(sample,bvh.joints.length),torso=conversion.clone().multiply(sourceBasis(positions)).multiply(targetBasis.clone().invert());
  vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
  const hipWorld=torso.clone().multiply(hipsWorldRest),parentQ=hips.parent.getWorldQuaternion(new Quaternion());hips.quaternion.copy(parentQ.invert().multiply(hipWorld));
  // scale is measured in world metres; convert its displacement through the full
  // parent linear transform so uniform scene scale is not applied a second time.
  const worldToLocalShift=shift=>shift.applyMatrix3(new Matrix3().setFromMatrix4(hips.parent.matrixWorld).invert());
  hips.position.copy(hipsRest).add(worldToLocalShift(new Vector3(0,(positions[index.Hips][1]-first[index.Hips][1])*scale,0)));
  if(rootMode==='source'){
   const shift=v(positions[index.Hips]).sub(v(first[index.Hips])).applyQuaternion(rootConversion).multiplyScalar(scale);hips.position.copy(hipsRest).add(worldToLocalShift(shift));
  }
  if(rootMode==='balance'){
   // Retain hip weight shifts relative to the feet, without importing metres of travel.
   const balance=p=>v(p[index.Hips]).sub(v(p[index.Foot_L]).add(v(p[index.Foot_R])).multiplyScalar(.5));
   const shift=balance(positions).sub(balance(first));shift.y=0;shift.applyQuaternion(rootConversion).multiplyScalar(scale);hips.position.add(worldToLocalShift(shift));
  }
  hips.updateWorldMatrix(false,true);
  const diagnostics={sourceFeet:{left:positions[index.Foot_L].map(x=>x*scale),right:positions[index.Foot_R].map(x=>x*scale)},sourceHips:positions[index.Hips].map(x=>x*scale),frame,bones:0,changed:frame!==lastFrame,directions:{}};lastFrame=frame;
  for(const [name,start,end] of VRM_LINKS){
   const rest=targetRest[name];if(!rest)continue;
   const desired=v(positions[index[end]]).sub(v(positions[index[start]])).applyQuaternion(conversion).normalize();
   const baseDirection=rest.direction.clone().applyQuaternion(torso);
   const world=new Quaternion().setFromUnitVectors(baseDirection,desired).multiply(torso).multiply(rest.quaternion);
   rest.bone.quaternion.copy(rest.bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));rest.bone.updateWorldMatrix(false,true);diagnostics.bones++;diagnostics.directions[name]=desired.toArray();
   if(/UpperArm|LowerLeg/.test(name))diagnostics[name]=rest.bone.quaternion.toArray();
  }
  return diagnostics;
 }
 return {apply,applyFrame,worldAlignment,scale,mappedBones:Object.keys(targetRest),sourceToTargetRotation:conversion.toArray()}
}
