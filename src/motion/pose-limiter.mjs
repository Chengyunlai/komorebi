import {Quaternion} from 'three'

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lowerBody=new Set(['hips','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftToes','rightToes']);
const copy=pose=>structuredClone(pose);
const ratio=(distance,cap)=>distance>0?Math.min(1,cap/distance):1;
/** Limit a copied pose; coherent mode preserves lower-body target relationships. */
export function limitMotionPose(previous,desired,{dt=0,angularSpeed=0,rootSpeed=0,mode='legacy'}={}){
 if(!['legacy','coherent-lower-body','planned-lower-body'].includes(mode))throw new Error(`Unknown pose limiter mode: ${mode}`);
 const pose=copy(desired),elapsed=Math.max(0,Number.isFinite(dt)?dt:0),angularCap=elapsed*Math.max(0,Number.isFinite(angularSpeed)?angularSpeed:0),rootCap=elapsed*Math.max(0,Number.isFinite(rootSpeed)?rootSpeed:0);
 let factor=1;
 const factors={};
 if(previous){
  for(const name of Object.keys(desired.rotations)){
   if(!previous.rotations?.[name])continue;
   const distance=new Quaternion().fromArray(previous.rotations[name]).angleTo(new Quaternion().fromArray(desired.rotations[name]));
   factors[name]=ratio(distance,angularCap);
   if(mode==='coherent-lower-body'&&lowerBody.has(name))factor=Math.min(factor,factors[name]);
  }
  if(mode==='coherent-lower-body')for(let i=0;i<desired.hips.length;i++)factor=Math.min(factor,ratio(Math.abs(desired.hips[i]-previous.hips[i]),rootCap));
  for(const name of Object.keys(factors)){if(mode==='planned-lower-body'&&lowerBody.has(name))continue;pose.rotations[name]=new Quaternion().fromArray(previous.rotations[name]).slerp(new Quaternion().fromArray(desired.rotations[name]),mode==='coherent-lower-body'&&lowerBody.has(name)?factor:factors[name]).toArray();}
  if(mode!=='planned-lower-body')pose.hips=desired.hips.map((v,i)=>previous.hips[i]+(mode==='coherent-lower-body'?(v-previous.hips[i])*factor:clamp(v-previous.hips[i],-rootCap,rootCap)));
  if(mode==='coherent-lower-body'&&previous.feet&&desired.feet)for(const side of ['left','right'])if(previous.feet[side]&&desired.feet[side])pose.feet[side]=desired.feet[side].map((v,i)=>previous.feet[side][i]+(v-previous.feet[side][i])*factor);
 }
 const feetTargetShift=Math.max(0,...['left','right'].map(side=>pose.feet?.[side]&&desired.feet?.[side]?Math.hypot(...pose.feet[side].map((v,i)=>v-desired.feet[side][i])):0));
 return {pose,metrics:{mode,factor,feetTargetShift}};
}
