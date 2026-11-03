import {Vector3,Quaternion} from 'three'
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Analytic two-bone leg: support foot stays at its target while pelvis moves. */
export function solveLeg(upper,lower,foot,target,forward=new Vector3(0,0,1)){
 upper.updateWorldMatrix(true,true);const hip=upper.getWorldPosition(new Vector3()),knee=lower.getWorldPosition(new Vector3()),ankle=foot.getWorldPosition(new Vector3());const a=hip.distanceTo(knee),b=knee.distanceTo(ankle);if(a<1e-5||b<1e-5)throw Error('腿部骨骼长度无效');
 const axis=target.clone().sub(hip),distance=clamp(axis.length(),Math.abs(a-b)+.0001,a+b-.0001);axis.normalize();
 let pole=forward.clone().addScaledVector(axis,-forward.dot(axis));if(pole.lengthSq()<1e-8)pole=new Vector3(1,0,0).addScaledVector(axis,-axis.x);pole.normalize();
 const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along)),desiredKnee=hip.clone().addScaledVector(axis,along).addScaledVector(pole,height),reachable=hip.clone().addScaledVector(axis,distance);
 const aim=(bone,child,destination)=>{const from=bone.getWorldPosition(new Vector3()),direction=child.getWorldPosition(new Vector3()).sub(from).normalize(),wanted=destination.clone().sub(from).normalize(),world=new Quaternion().setFromUnitVectors(direction,wanted).multiply(bone.getWorldQuaternion(new Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));bone.updateWorldMatrix(false,true)};
 aim(upper,lower,desiredKnee);aim(lower,foot,reachable);return {error:foot.getWorldPosition(new Vector3()).distanceTo(target),reachable:Math.abs(axis.length())>0&&Math.abs(target.distanceTo(hip)-distance)<.001};
}
export function createFootPlant(vrm){
 vrm.scene.updateMatrixWorld(true);const legs={};
 for(const side of ['left','right']){const upper=vrm.humanoid.getNormalizedBoneNode(side+'UpperLeg'),lower=vrm.humanoid.getNormalizedBoneNode(side+'LowerLeg'),foot=vrm.humanoid.getNormalizedBoneNode(side+'Foot');if(!upper||!lower||!foot)throw Error('缺少腿部骨骼');legs[side]={upper,lower,foot,rest:foot.getWorldPosition(new Vector3()),rotation:foot.getWorldQuaternion(new Quaternion()),length:upper.getWorldPosition(new Vector3()).distanceTo(lower.getWorldPosition(new Vector3()))+lower.getWorldPosition(new Vector3()).distanceTo(foot.getWorldPosition(new Vector3()))}}
 const lateralSign=Math.sign(legs.left.rest.x-legs.right.rest.x)||1;
 const displacement=offset=>new Vector3(offset[0]*lateralSign,offset[1],offset[2]);
 return {lateralSign,apply(offsets){
 // Lower the pelvis just enough to keep both ankle targets reachable during side steps.
 const hips=vrm.humanoid.getNormalizedBoneNode('hips');vrm.scene.updateMatrixWorld(true);let drop=0;
 for(const side of ['left','right']){const l=legs[side],target=l.rest.clone().add(displacement(offsets?.[side]||[0,0,0]).multiplyScalar(l.length)),hip=l.upper.getWorldPosition(new Vector3()),horizontal=(hip.x-target.x)**2+(hip.z-target.z)**2,vertical=Math.sqrt(Math.max(0,(l.length-.0005)**2-horizontal));drop=Math.max(drop,hip.y-target.y-vertical)}
 hips.position.y-=clamp(drop,0,.12);hips.updateWorldMatrix(true,true);
 let maxError=0;for(const side of ['left','right']){const l=legs[side],offset=offsets?.[side]||[0,0,0],target=l.rest.clone().add(displacement(offset).multiplyScalar(l.length));const result=solveLeg(l.upper,l.lower,l.foot,target);l.foot.quaternion.copy(l.foot.parent.getWorldQuaternion(new Quaternion()).invert().multiply(l.rotation));l.foot.updateWorldMatrix(false,true);maxError=Math.max(maxError,result.error)}return maxError}}
}
