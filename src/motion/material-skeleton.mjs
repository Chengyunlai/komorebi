import {Matrix4,Vector3,Quaternion} from 'three'
/** Rebuild source-world FK. Existing adapters calibrate in original BVH units,
 * so metre translations are converted back exactly once at this boundary. */
export function sourcePoseToSkeleton(material,pose,{frame=pose?.frame??-1}={}){
 const scale=material?.metersPerUnit,rig=material?.rig;
 if(!Number.isFinite(scale)||scale<=0||!Array.isArray(rig)||!rig.length||!pose?.joints)throw Error('Invalid source material or pose');
 const index=new Map(),world=[],positions=[],matrices=[];
 for(let i=0;i<rig.length;i++){
  const joint=rig[i],value=pose.joints[joint.id];
  if(index.has(joint.id)||joint.parent!==null&&!index.has(joint.parent))throw Error('Source rig must have unique parent-before-child IDs');
  if(!value||!Array.isArray(value.position)||value.position.length!==3||!value.position.every(Number.isFinite)||!Array.isArray(value.rotation)||value.rotation.length!==4||!value.rotation.every(Number.isFinite)||Math.hypot(...value.rotation)<1e-12)throw Error('Invalid source joint transform');
  const local=new Matrix4().compose(new Vector3(...value.position).multiplyScalar(1/scale),new Quaternion().fromArray(value.rotation).normalize(),new Vector3(1,1,1));
  const matrix=joint.parent===null?local:world[index.get(joint.parent)].clone().multiply(local);
  world.push(matrix);positions.push(new Vector3().setFromMatrixPosition(matrix).toArray());matrices.push(matrix.clone().transpose().toArray());index.set(joint.id,i);
 }
 if(rig.filter(j=>j.parent===null).length!==1)throw Error('Source rig needs one root');
 const rootId=material.rootBones?.hierarchy;
 if(pose.root&&rootId){const root=pose.joints[rootId];if(!Array.isArray(pose.root.position)||pose.root.position.length!==3||!pose.root.position.every(Number.isFinite)||!Array.isArray(pose.root.rotation)||pose.root.rotation.length!==4||!pose.root.rotation.every(Number.isFinite)||Math.hypot(...pose.root.rotation)<1e-12)throw Error('Invalid duplicated root');if(pose.root.bone!==rootId||pose.root.position?.some((v,i)=>Math.abs(v-root.position[i])>1e-8)||Math.abs(new Quaternion().fromArray(pose.root.rotation).normalize().dot(new Quaternion().fromArray(root.rotation).normalize()))<1-1e-8)throw Error('Inconsistent duplicated source root');}
 return {frame,positions,matrices,coordinate:{unit:'original-source-unit',metersPerUnit:scale,space:'source-world',matrix:'row-major'}};
}
