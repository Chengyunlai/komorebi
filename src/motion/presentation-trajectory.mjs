import {Matrix4,Vector3} from 'three'
const validPoint=point=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
/** Offline centered box smoothing: future source samples are available during compilation.
 * This is a presentation path, with no claim of real-time causal filtering.
 * Each inclusive window clamps its endpoints to the valid source sample range.
 */
export function buildPresentationOffsets(points,{fps,windowSeconds=2}={}){
 if(!Array.isArray(points)||!points.length||!points.every(validPoint))throw new Error('points must contain finite xyz world positions');
 if(!Number.isFinite(fps)||fps<=0||!Number.isFinite(windowSeconds)||windowSeconds<=0)throw new Error('fps and windowSeconds must be positive and finite');
 const radius=Math.floor(fps*windowSeconds/2),prefix=[[0,0]];
 for(const point of points){const previous=prefix.at(-1);prefix.push([previous[0]+point[0],previous[1]+point[2]])}
 const smoothed=points.map((_,index)=>{const start=Math.max(0,index-radius),end=Math.min(points.length-1,index+radius),count=end-start+1;return [(prefix[end+1][0]-prefix[start][0])/count,0,(prefix[end+1][1]-prefix[start][1])/count]});
 const origin=smoothed[0];return smoothed.map(point=>[point[0]-origin[0],0,point[2]-origin[2]]);
}
/** Translate root-local offset and world feet together without modifying rotation channels. */
export function translateMotionPose(pose,worldShift,poseSpace={}){
 if(!pose||!validPoint(pose.hips)||!validPoint(worldShift))throw new Error('pose hips and worldShift must be finite xyz positions');
 const rest=poseSpace.hipsRest??[0,0,0],values=poseSpace.hipsParentWorldMatrix;
 if(!validPoint(rest)||values!==undefined&&(!Array.isArray(values)||values.length!==16||!values.every(Number.isFinite)))throw new Error('invalid pose space');
 if(pose.feet&&Object.values(pose.feet).some(point=>!validPoint(point)))throw new Error('feet must contain finite xyz world positions');
 const parent=new Matrix4();if(values)parent.fromArray(values);
 if(Math.abs(parent.determinant())<1e-12)throw new Error('hips parent transform must be invertible');
 const result=structuredClone(pose),restVector=new Vector3().fromArray(rest);
 result.hips=new Vector3().fromArray(pose.hips).add(restVector).applyMatrix4(parent).add(new Vector3().fromArray(worldShift)).applyMatrix4(parent.clone().invert()).sub(restVector).toArray();
 if(pose.feet)for(const [side,point]of Object.entries(pose.feet))result.feet[side]=point.map((value,index)=>value+worldShift[index]);
 return result;
}
