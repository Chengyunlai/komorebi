import {limitMotionPose} from './pose-limiter.mjs'
import {Quaternion} from 'three'
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
const angle=(a,b)=>2*Math.acos(clamp(Math.abs(a.reduce((s,v,i)=>s+v*b[i],0)),0,1));
export function blendMotionPoses(a,b,t){
 const rotations={};for(const name of Object.keys(a.rotations))rotations[name]=new Quaternion().fromArray(a.rotations[name]).slerp(new Quaternion().fromArray(b.rotations[name]||a.rotations[name]),t).toArray();
 const result={rotations,hips:a.hips.map((v,i)=>v+(b.hips[i]-v)*t)};
 const valid=p=>['left','right'].every(side=>Array.isArray(p?.[side])&&p[side].length===3&&p[side].every(Number.isFinite));
 if(valid(a.feet)&&valid(b.feet))result.feet=Object.fromEntries(['left','right'].map(side=>[side,a.feet[side].map((v,i)=>v+(b.feet[side][i]-v)*t)]));
 return result;
}
/** Local research poses only. No motion assets are embedded in this module. */
export function createMotionBank(frames,{fps=15,seconds=4.8}={}){
 if(!Number.isFinite(fps)||fps<=0||!Number.isFinite(seconds)||seconds<1||frames.length<fps*seconds*2)throw Error('动作参考过短或采样率无效');
 const names=Object.keys(frames[0].rotations),span=Math.round(seconds*fps),clips=[];
 const velocity=i=>Object.fromEntries(names.map(n=>[n,angle(frames[i].rotations[n],frames[Math.max(0,i-1)].rotations[n])*fps]));
 const contacts=i=>['left','right'].map(side=>{const p=frames[i].feet?.[side],q=frames[Math.max(0,i-1)].feet?.[side];return p&&q?Math.hypot(...p.map((v,k)=>v-q[k]))*fps<.12&&p[1]<.10:false});
 for(let start=0;start+span+fps<frames.length;start+=span){let activity=0;for(let i=start+1;i<start+span;i++)for(const n of names)activity+=angle(frames[i-1].rotations[n],frames[i].rotations[n]);clips.push({start,end:start+span,activity:activity/(span*names.length)*fps,velocity:velocity(start),contacts:contacts(start)})}
 const max=Math.max(...clips.map(c=>c.activity),.001);for(const c of clips)c.activity/=max;
 return {frames,fps,clips,names,velocity,contacts};
}
export class MotionBankPlayer{
 constructor(bank,{limiterMode='legacy',traceStages=false}={}){this.limiterMode=limiterMode;this.traceStages=traceStages;this.bank=bank;this.clip=0;this.time=0;this.weight=0;this.previous=null;this.transition=0;this.visits=bank.clips.map(()=>0);this.visits[0]=1;this.switches=0;this.output=null}
 sample(clip,time){const {frames,fps,clips}=this.bank,index=clamp(clips[clip].start+time*fps,0,frames.length-1),i=Math.floor(index);return blendMotionPoses(frames[i],frames[Math.min(i+1,frames.length-1)],index-i)}
 choose(energy){
 const b=this.bank,current=b.clips[this.clip],end=current.end,pose=b.frames[end],velocity=b.velocity(end),contacts=b.contacts(end);let best=Infinity,winner=this.clip;
 b.clips.forEach((c,i)=>{if(i===this.clip)return;const candidate=b.frames[c.start];let cost=0;for(const n of b.names)cost+=angle(pose.rotations[n],candidate.rotations[n])**2+.025*(velocity[n]-c.velocity[n])**2;cost/=b.names.length;cost+=contacts.reduce((s,v,k)=>s+(v!==c.contacts[k]?.25:0),0);cost+=Math.abs(c.activity-clamp(energy,0,1))*.3+this.visits[i]*.025;if(cost<best){best=cost;winner=i}});return winner;
 }
 step({dt=0,active=false,bpm=100,energy=.5}={}){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.weight=clamp(this.weight+(active?dt/.5:-dt/.35),0,1);
 const rate=clamp((Number.isFinite(bpm)?bpm:100)/100,.7,1.3);
 if(active||this.weight>0){this.time+=dt*rate;if(this.previous)this.transition+=dt;
 const clip=this.bank.clips[this.clip],duration=(clip.end-clip.start)/this.bank.fps;
 if(this.time>=duration){const next=this.choose(energy);this.previous={clip:this.clip,time:this.time};this.clip=next;this.time-=duration;this.transition=0;this.visits[next]++;this.switches++}}
 let pose=this.sample(this.clip,this.time);
 const sample=this.traceStages?structuredClone(pose):null;
 if(this.previous){const t=clamp(this.transition/.5,0,1);pose=blendMotionPoses(this.sample(this.previous.clip,this.previous.time+this.transition*rate),pose,smooth(t));if(t===1)this.previous=null}
 // Bound source discontinuities and retarget flips before they reach the avatar.
 const blended=this.traceStages?structuredClone(pose):null;
 const limited=limitMotionPose(this.output,pose,{dt,angularSpeed:7,rootSpeed:0.4,mode:this.limiterMode});pose=limited.pose;
 if(this.traceStages)this.lastStages={sample,blended,limited:structuredClone(pose)};
 this.output=pose;
 return {...pose,limiter:limited.metrics,weight:this.weight,clip:this.clip,switches:this.switches,transition:this.previous?this.transition:null};
 }
}
