import {parseMotion,sampleCurve} from '../motion-lab/curves.mjs'
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=t=>t*t*t*(t*(t*6-15)+10);
/** Interpret Hiyori m05's small gestures on VRM; parameter IDs are not bone angles. */
export class VRMIdleController{
 constructor(source){this.source=source.Meta?.Source||'original-idle';this.motion=parseMotion(source);this.curves=new Map(this.motion.curves.filter(c=>c.target==='Parameter').map(c=>[c.id,c]));this.time=0;this.weight=1;this.fade=.35;this.period=this.motion.duration-this.fade}
 value(id,time,neutral=0){const c=this.curves.get(id);if(!c)return neutral;const t=((time%this.period)+this.period)%this.period;if(t>=this.fade)return sampleCurve(c,t);const w=smooth(t/this.fade);return sampleCurve(c,t+this.period)*(1-w)+sampleCurve(c,t)*w}
 sample(time=this.time){const value=(id,n=0)=>this.value(id,time,n),left=(value('ParamArmLA',-10)+10)/20,right=(value('ParamArmRA',-10)+10)/20;
 return {rotations:{hips:[0,value('ParamBodyAngleX')/10*.045,-value('ParamBodyAngleZ')/10*.035],spine:[0,value('ParamBodyAngleX')/10*.055,-value('ParamBodyAngleZ')/10*.035],chest:[-.012*value('ParamBreath'),0,0],head:[-value('ParamAngleY')/30*.22,value('ParamAngleX')/30*.28,-value('ParamAngleZ')/30*.17],leftUpperArm:[-.05*left,0,-1.25+left*.3],rightUpperArm:[-.05*right,0,1.25-right*.3],leftLowerArm:[0,-.15-left*.12,0],rightLowerArm:[0,.15+right*.12,0]},hips:[0,value('ParamBodyAngleY')/10*.006,0],expressions:{blinkLeft:clamp(1-value('ParamEyeLOpen',1)),blinkRight:clamp(1-value('ParamEyeROpen',1)),happy:clamp(value('ParamMouthForm')*.12)},look:{yaw:value('ParamEyeBallX')*8,pitch:-value('ParamEyeBallY')*5}};
 }
 step({dt=0,pose,reducedMotion=false}){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);const performing=['audio','preview'].includes(pose.source?.mode)&&pose.source?.primitive!=='rest';const target=reducedMotion?0:performing?0:1-clamp((pose.source?.strength||0)/.3);this.weight+=(target-this.weight)*(1-Math.exp(-dt/.25));if(this.weight>.001&&!reducedMotion)this.time+=dt;
 const idle=this.sample(),weight=reducedMotion?0:this.weight,rotations={};
 for(const key of new Set([...Object.keys(pose.rotations),...Object.keys(idle.rotations)])){const base=pose.rotations[key]||[0,0,0],other=idle.rotations[key]||base;rotations[key]=base.map((v,i)=>v*(1-weight)+other[i]*weight)}
 return {...pose,rotations,hips:pose.hips.map((v,i)=>v*(1-weight)+idle.hips[i]*weight),feet:Object.fromEntries(Object.entries(pose.feet).map(([side,values])=>[side,values.map(v=>v*(1-weight))])),idle:{source:this.source,time:this.time,weight},expressions:Object.fromEntries(Object.entries(idle.expressions).map(([key,v])=>[key,v*weight])),look:{yaw:idle.look.yaw*weight,pitch:idle.look.pitch*weight}};
 }
}
