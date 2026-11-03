import {skeletonAt} from './bvh.mjs';
export const RETARGET_IDS=['ParamAngleX','ParamAngleY','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamArmLA','ParamArmRA'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);if(n<1e-7)throw Error('骨架参考轴退化，无法映射');return v.map(x=>x/n)};
const transpose=m=>[m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]];
const multiply=(a,b)=>Array.from({length:9},(_,i)=>{let s=0;for(let k=0;k<3;k++)s+=a[Math.floor(i/3)*3+k]*b[k*3+i%3];return s});
const angles=m=>({yaw:Math.atan2(m[2],m[8])*180/Math.PI,pitch:Math.atan2(m[7],m[4])*180/Math.PI,roll:Math.atan2(-m[1],m[4])*180/Math.PI});
export function measureUpperBody(bvh,time){
 const {positions,matrices}=skeletonAt(bvh,time),index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i]));
 for(const name of ['Hips','Neck','Head','UpperArm_L','UpperArm_R','LowerArm_L','LowerArm_R'])if(index[name]===undefined)throw Error('缺少映射关节：'+name);
 const p=name=>positions[index[name]],up=unit(sub(p('Neck'),p('Hips'))),shoulders=sub(p('UpperArm_R'),p('UpperArm_L'));
 const right=unit(sub(shoulders,up.map(x=>x*dot(shoulders,up)))),forward=unit(cross(right,up));
 const basis=[right[0],up[0],forward[0],right[1],up[1],forward[1],right[2],up[2],forward[2]];
 const headMatrix=matrices[index.Head],headRotation=[headMatrix[0],headMatrix[1],headMatrix[2],headMatrix[4],headMatrix[5],headMatrix[6],headMatrix[8],headMatrix[9],headMatrix[10]];
 const elevation=side=>{const arm=unit(sub(p('LowerArm_'+side),p('UpperArm_'+side)));return Math.acos(clamp(-dot(arm,up),-1,1))*180/Math.PI};
 return {basis,headRelative:multiply(transpose(basis),headRotation),leftElevation:elevation('L'),rightElevation:elevation('R')};
}
export function retargetPose(current,reference,{gain=1,mirror=false}={}){
 if(!Number.isFinite(gain)||gain<0||gain>2)throw Error('映射增益必须在0–2之间');
 const body=angles(multiply(transpose(reference.basis),current.basis)),head=angles(multiply(current.headRelative,transpose(reference.headRelative)));
 const pose={ParamAngleX:head.yaw/80*gain,ParamAngleY:head.pitch/100*gain,ParamAngleZ:head.roll/50*gain,ParamBodyAngleX:Math.sin(body.yaw*Math.PI/180)*gain,ParamBodyAngleY:body.pitch/40*gain,ParamBodyAngleZ:body.roll/45*gain,ParamArmLA:current.leftElevation/120*gain*2-1,ParamArmRA:current.rightElevation/120*gain*2-1};
 if(mirror){for(const id of ['ParamAngleX','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleZ'])pose[id]*=-1;[pose.ParamArmLA,pose.ParamArmRA]=[pose.ParamArmRA,pose.ParamArmLA]}
 return {pose,body,head,leftElevation:current.leftElevation,rightElevation:current.rightElevation};
}
export function buildRetargetMotion(bvh,rig,options={}){
 const known=new Map(rig.map(r=>[r.id,r]));
 for(const id of RETARGET_IDS){const r=known.get(id);if(!r||![r.min,r.max,r.neutral].every(Number.isFinite)||r.max<=r.min)throw Error('目标角色缺少有效通道：'+id)}
 const reference=measureUpperBody(bvh,0),curves=RETARGET_IDS.map(id=>({Target:'Parameter',Id:id,Segments:[]})),filtered={},clipped=Object.fromEntries(RETARGET_IDS.map(id=>[id,0]));
 const alpha=1-Math.exp(-bvh.frameTime/.09);let maxNormalizedStep=0,firstActiveTime=null;
 for(let frame=0;frame<bvh.frameCount;frame++){
  const time=frame*bvh.frameTime,measured=measureUpperBody(bvh,time),features=retargetPose(measured,reference,options),{pose}=features;
  if(firstActiveTime===null&&time>.5&&(Math.abs(measured.leftElevation-reference.leftElevation)+Math.abs(measured.rightElevation-reference.rightElevation)>25||Math.abs(features.body.yaw)>15))firstActiveTime=Math.max(0,time-.4);
  curves.forEach(curve=>{
   const id=curve.Id,r=known.get(id),value=pose[id];if(Math.abs(value)>1)clipped[id]++;
   const target=clamp(value,-1,1),previous=filtered[id]??target;filtered[id]=previous+clamp((target-previous)*alpha,-4*bvh.frameTime,4*bvh.frameTime);maxNormalizedStep=Math.max(maxNormalizedStep,Math.abs(filtered[id]-previous));
   const normalized=filtered[id],output=r.neutral+normalized*(normalized>=0?r.max-r.neutral:r.neutral-r.min);
   if(frame)curve.Segments.push(0,time,output);else curve.Segments.push(time,output);
  });
 }
 const duration=(bvh.frameCount-1)*bvh.frameTime;
 return {source:{Version:3,Meta:{Duration:duration,Fps:1/bvh.frameTime,Loop:false,AreBeziersRestricted:true,CurveCount:curves.length,TotalSegmentCount:curves.length*(bvh.frameCount-1),TotalPointCount:curves.length*bvh.frameCount,UserDataCount:0,TotalUserDataSize:0},Curves:curves},stats:{frames:bvh.frameCount,duration,channels:curves.length,clippedPercent:Object.fromEntries(Object.entries(clipped).map(([id,n])=>[id,n/bvh.frameCount*100])),maxNormalizedStep,firstActiveTime:firstActiveTime??0,omitted:['肘部独立弯曲','髋、膝、踝与步伐','根节点平移'],calibration:'首帧朝向；头部俯仰压缩到100度量程；身体转向用正弦投影避免背向翻转；手臂120度抬起映射到上限；90ms平滑与每秒4单位限速'}};
}
