import {Matrix4,Vector3,Quaternion} from 'three'
import {skeletonAt} from '../motion-lab/bvh.mjs'
/** Preserve source-local transforms, including the auxiliary trajectory root. */
export function captureSourceRecord(bvh,time,{scaleToMetres=1,bodyId='bvh-source'}={}){
 if(!Number.isFinite(time)||time<0||!Number.isFinite(scaleToMetres)||scaleToMetres<=0)throw Error('源记录时间或尺度无效');
 const sampled=skeletonAt(bvh,time),joints={};
 for(let i=0;i<bvh.joints.length;i++){
  const joint=bvh.joints[i],world=new Matrix4().fromArray(sampled.matrices[i]).transpose();
  const local=joint.parent<0?world:new Matrix4().fromArray(sampled.matrices[joint.parent]).transpose().invert().multiply(world);
  const position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();local.decompose(position,rotation,scale);
  joints[`${i}:${joint.name}`]={position:position.multiplyScalar(scaleToMetres).toArray(),rotation:rotation.normalize().toArray()};
 }
 const rootId=`0:${bvh.joints[0].name}`;
 return {schema:'motion-record/v1',bodyId,time:sampled.frame*bvh.frameTime,sourceTime:sampled.frame*bvh.frameTime,stage:'source',coordinate:{unit:'metre',space:'source-local-absolute',quaternion:'xyzw',axes:'source-rig-y-up'},root:{bone:rootId,...joints[rootId]},joints,source:{frame:sampled.frame,scaleToMetres,rig:bvh.joints.map((j,i)=>({id:`${i}:${j.name}`,parent:j.parent<0?null:`${j.parent}:${bvh.joints[j.parent].name}`})),note:'source rig is not directly applicable to the normalized VRM rig'}};
}
