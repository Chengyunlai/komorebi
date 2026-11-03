import {Matrix4,Quaternion,Vector3} from 'three'
const up=new Vector3(0,1,0);
function space(definition={}){
 const parent=new Matrix4();if(definition.hipsParentWorldMatrix)parent.fromArray(definition.hipsParentWorldMatrix);
 const parentQ=new Quaternion();parent.decompose(new Vector3(),parentQ,new Vector3());
 const rest=new Vector3().fromArray(definition.hipsRest||[0,0,0]);
 return {parent,parentQ,rest,pivot:rest.clone().applyMatrix4(parent)};
}
export function motionPoseHeading(pose,definition){
 const {parentQ}=space(definition),right=new Vector3(1,0,0).applyQuaternion(parentQ.multiply(new Quaternion().fromArray(pose.rotations.hips)));
 return Math.atan2(-right.z,right.x);
}
/** Rotate world targets and the root around the fixed rest pivot, retaining local limb rotations. */
export function yawMotionPose(pose,yaw,definition){
 const result=structuredClone(pose);if(!yaw)return result;
 const {parent,parentQ,rest,pivot}=space(definition),rotation=new Quaternion().setFromAxisAngle(up,yaw);
 result.rotations.hips=parentQ.clone().invert().multiply(rotation).multiply(parentQ).multiply(new Quaternion().fromArray(pose.rotations.hips)).toArray();
 result.hips=new Vector3().fromArray(pose.hips).add(rest).applyMatrix4(parent).sub(pivot).applyQuaternion(rotation).add(pivot).applyMatrix4(parent.clone().invert()).sub(rest).toArray();
 if(pose.feet)for(const side of ['left','right'])if(pose.feet[side])result.feet[side]=new Vector3().fromArray(pose.feet[side]).sub(pivot).applyQuaternion(rotation).add(pivot).toArray();
 return result;
}
export const wrappedYaw=value=>Math.atan2(Math.sin(value),Math.cos(value));
