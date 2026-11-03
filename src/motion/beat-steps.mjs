import {motionPoseHeading,yawMotionPose,wrappedYaw} from './pose-space.mjs'
import {limitMotionPose} from './pose-limiter.mjs'
import {Quaternion} from 'three'
import {createMotionBank,blendMotionPoses} from './motion-bank.mjs'
import {analyzeFootContacts} from './contact-analysis.mjs'
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
function beatAtSourceFrame(clip,frame){const i=Math.min(clip.anchors.length-2,Math.max(0,clip.anchors.findIndex((a,k)=>clip.anchors[k+1]?.frame>=frame)));const a=clip.anchors[i],b=clip.anchors[i+1];return a.beat+(frame-a.frame)/(b.frame-a.frame)*(b.beat-a.beat)}
const quaternionAngle=(a,b)=>new Quaternion().fromArray(a).angleTo(new Quaternion().fromArray(b));
function boundaryCost(bank,from,to){
 const a=bank.frames[from.end],b=bank.frames[to.start];
 return bank.names.reduce((sum,name)=>sum+quaternionAngle(a.rotations[name],b.rotations[name])**2,0)/bank.names.length;
}
/** Select short, alternating landing phrases. Landing == estimated beat is an explicit hypothesis. */
export function createBeatMotionBank(frames,{fps=15,contactFrames=frames,maxClips=3}={}){
 const bank=createMotionBank(frames,{fps}),contact=analyzeFootContacts(contactFrames,{fps}),candidates=[];
 const validFoot=(index,side)=>contactFrames[index]?.feet?.[side]?.length===3&&contactFrames[index].feet[side].every(Number.isFinite);
 // Stable contact confirms the event; backtrack to its visible ankle-height crossing.
 const landings=contact.landings.flatMap(event=>{let frame=event.frame;const floor=contact.diagnostics.groundHeight,side=event.side;
  while(frame>Math.max(0,event.frame-Math.ceil(fps*.4))&&validFoot(frame-1,side)&&contactFrames[frame-1].feet[side][1]-floor<=.025)frame--;
  const window=contactFrames.slice(Math.max(0,frame-Math.ceil(fps*.7)),frame);const lifted=window.every(f=>f?.feet?.[side]?.every(Number.isFinite))&&window.some(f=>f.feet[side][1]-floor>.06);
  return lifted?[{...event,frame,confirmedFrame:event.frame}]:[];
 }).sort((a,b)=>a.frame-b.frame);
 for(let i=0;i+2<landings.length;i++){
  const events=landings.slice(i,i+3),[a,b,c]=events;
  const intervals=[(b.frame-a.frame)/fps,(c.frame-b.frame)/fps];
  if(a.side===b.side||a.side!==c.side||intervals.some(t=>t<.3||t>1.05)||Math.max(...intervals)/Math.min(...intervals)>1.8)continue;
  const duration=(c.frame-a.frame)/fps,hips=contactFrames.slice(a.frame,c.frame+1).map(f=>f.hips),travel=Math.hypot(...hips.at(-1).map((v,k)=>v-hips[0][k]));
  let activity=0;for(let j=a.frame+1;j<=c.frame;j++)for(const n of bank.names)activity+=quaternionAngle(frames[j-1].rotations[n],frames[j].rotations[n]);
  activity/=duration*bank.names.length;if(activity<.08)continue;
  candidates.push({start:a.frame,end:c.frame,beats:2,anchors:events.map((event,beat)=>({...event,beat})),support:a.side,activity,quality:Math.abs(intervals[0]-intervals[1])/duration+travel*.08,sourceBpm:120/duration});
 }
 // A shared landing foot makes all selected boundaries contact-compatible.
 const groups=['left','right'].map(side=>candidates.filter(c=>c.support===side));groups.sort((a,b)=>b.length-a.length);
 const selected=[];for(const candidate of groups[0].sort((a,b)=>a.quality-b.quality)){
  if(selected.some(c=>Math.abs(c.start-candidate.start)<fps*.8))continue;
  selected.push(candidate);if(selected.length===maxClips)break;
 }
 if(selected.length<maxClips)throw Error('没有足够可靠的交替落脚片段；保留原有动作库');
 selected.sort((a,b)=>a.start-b.start);const maxActivity=Math.max(...selected.map(c=>c.activity));
 bank.motionLandings=landings;bank.clips=selected.map((c,id)=>({...c,id,activity:c.activity/maxActivity}));bank.contact=contact;bank.footHeights=contactFrames.map(f=>Object.fromEntries(['left','right'].map(side=>[side,Math.max(0,f.feet[side][1]-contact.diagnostics.groundHeight)])));bank.beatAligned=true;bank.contactMethod=contact.diagnostics.method;
 bank.transitions=bank.clips.map(from=>bank.clips.map(to=>({allowed:from.support===to.support,cost:boundaryCost(bank,from,to)})));
 return bank;
}
/** Piecewise time warp: each estimated landing is placed on an integer music-clock beat. */
export function sourceFrameAtBeat(clip,beat){
 const phase=clamp(beat,0,clip.beats),index=Math.min(clip.anchors.length-2,Math.floor(phase)),a=clip.anchors[index],b=clip.anchors[index+1];
 return a.frame+(b.frame-a.frame)*(phase-a.beat)/(b.beat-a.beat);
}
export class BeatStepPlayer{
 constructor(bank,{limiterMode='legacy',traceStages=false,transitionPolicy='static',transitionBeats=.3}={}){if(!Number.isFinite(transitionBeats)||transitionBeats<=0||transitionBeats>Math.min(...bank.clips.map(c=>c.beats))/2)throw new Error('transitionBeats must be positive and at most half the shortest clip');this.transitionBeats=transitionBeats;this.incomingPrerollMethod=null;if(!['static','heading-preroll'].includes(transitionPolicy))throw new Error('Unknown transition policy: '+transitionPolicy);this.transitionPolicy=transitionPolicy;this.clipYaw=0;this.plannedYaw=null;this.limiterMode=limiterMode;this.traceStages=traceStages;this.bank=bank;this.clip=0;this.clipStartBeat=null;this.clockEpoch=null;this.lastBeat=null;this.internalBeat=0;this.weight=0;this.output=null;this.plannedNext=null;this.switches=0;this.blockedTransitions=0;this.visits=bank.clips.map(()=>0);this.visits[0]=1}
 sample(frame){const i=clamp(frame,0,this.bank.frames.length-1),index=Math.floor(i);const next=Math.min(index+1,this.bank.frames.length-1),t=i-index;return {...blendMotionPoses(this.bank.frames[index],this.bank.frames[next],t),footHeights:Object.fromEntries(['left','right'].map(side=>[side,this.bank.footHeights[index][side]*(1-t)+this.bank.footHeights[next][side]*t]))}}
 choose(energy){
  const choices=this.bank.transitions[this.clip].map((edge,index)=>({...edge,index})).filter(edge=>edge.allowed&&edge.index!==this.clip);
  if(!choices.length)return this.clip
  choices.sort((a,b)=>(a.cost+Math.abs(this.bank.clips[a.index].activity-energy)*.2+this.visits[a.index]*.06)-(b.cost+Math.abs(this.bank.clips[b.index].activity-energy)*.2+this.visits[b.index]*.06));return choices[0].index;
 }
 step({dt=0,active=false,bpm=100,energy=.5,beat,clockEpoch=0,timing='estimated'}={}){
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(active)this.internalBeat+=dt*clamp(Number.isFinite(bpm)?bpm:100,60,160)/60;
  const external=Number.isFinite(beat),now=external?beat:this.internalBeat;
  const reset=this.clockEpoch!==clockEpoch||this.lastBeat!==null&&now<this.lastBeat-.05;
  if(reset||this.clipStartBeat===null||active&&this.weight===0){this.clipStartBeat=Math.ceil(now-1e-7);this.clockEpoch=clockEpoch;this.plannedNext=null;this.plannedYaw=null}
  this.lastBeat=now;
  this.weight=clamp(this.weight+(active?dt/.35:-dt/.35),0,1);
  if(active){let remaining=now-this.clipStartBeat;
   // A clock discontinuity rebases, rather than rapidly switching through skipped clips.
   if(remaining>this.bank.clips[this.clip].beats*2){this.clipStartBeat=Math.ceil(now);remaining=0;this.plannedNext=null;this.plannedYaw=null}
   if(remaining>=this.bank.clips[this.clip].beats){const outgoing=this.clip,duration=this.bank.clips[outgoing].beats;this.clip=this.plannedNext??this.choose(clamp(Number.isFinite(energy)?energy:.5,0,1));if(this.transitionPolicy==='heading-preroll')this.clipYaw=this.plannedYaw??this.clipYaw;this.plannedNext=null;this.plannedYaw=null;if(this.clip===outgoing)this.blockedTransitions++;this.clipStartBeat+=duration;this.switches++;this.visits[this.clip]++;this.transition=0}
  }
  const clip=this.bank.clips[this.clip],clipBeat=clamp(now-this.clipStartBeat,0,clip.beats),sourceFrame=sourceFrameAtBeat(clip,clipBeat);
  let pose=this.sample(sourceFrame);
  if(this.transitionPolicy==='heading-preroll')pose=yawMotionPose(pose,this.clipYaw,this.bank.poseSpace);
  const sample=this.traceStages?structuredClone(pose):null;
  // Blend before the landing boundary; at the boundary the new stance is exact.
  const blendBeats=this.transitionBeats,untilBoundary=clip.beats-clipBeat;
  if(active&&untilBoundary<blendBeats){
   this.plannedNext??=this.choose(clamp(Number.isFinite(energy)?energy:.5,0,1));
   const next=this.bank.clips[this.plannedNext];let target,t;
   if(this.transitionPolicy==='heading-preroll'){
    const firstInterval=next.anchors[1].frame-next.start;
    const preceding=this.bank.motionLandings?.filter(event=>event.frame<next.start&&event.side!==next.support).at(-1);
    const precedingInterval=preceding?next.start-preceding.frame:null;
    const validPreceding=precedingInterval!==null&&precedingInterval/this.bank.fps>=.3&&precedingInterval/this.bank.fps<=1.05&&precedingInterval/firstInterval>=.5&&precedingInterval/firstInterval<=2;
    const prerollStart=Math.max(0,next.start-blendBeats*(validPreceding?precedingInterval:firstInterval));
    this.incomingPrerollMethod=validPreceding?'preceding-opposite-landing':'first-anchor-interval';
    if(this.plannedYaw===null)this.plannedYaw=wrappedYaw(motionPoseHeading(pose,this.bank.poseSpace)-motionPoseHeading(this.sample(prerollStart),this.bank.poseSpace));
    const progress=clamp(1-untilBoundary/blendBeats,0,1);
    target=yawMotionPose(this.sample(prerollStart+(next.start-prerollStart)*progress),this.plannedYaw,this.bank.poseSpace);
    t=progress*progress*progress*(10+progress*(-15+progress*6));
   }else{target=this.sample(next.start);t=smooth(1-untilBoundary/blendBeats)}
   const heights=pose.footHeights;pose={...blendMotionPoses(pose,target,t),footHeights:Object.fromEntries(['left','right'].map(side=>[side,heights[side]*(1-t)+target.footHeights[side]*t]))};
  }
 const blended=this.traceStages?structuredClone(pose):null;
 const limited=limitMotionPose(this.output,pose,{dt,angularSpeed:9,rootSpeed:0.6,mode:this.limiterMode});pose=limited.pose;
 if(this.traceStages)this.lastStages={sample,blended,limited:structuredClone(pose)};
  this.output=pose;
  const contacts=this.bank.contact.frames[Math.round(sourceFrame)],phaseError=Math.abs(beatAtSourceFrame(clip,Math.round(sourceFrame))-clipBeat)*60/(Number.isFinite(bpm)?bpm:100);
  return {...pose,limiter:limited.metrics,transitionPolicy:this.transitionPolicy,incomingPrerollMethod:this.incomingPrerollMethod,weight:this.weight,clip:this.clip,beat:now,clipBeat,sourceFrame,support:contacts.support,contacts,timing:external?timing:'estimated',phaseError,clockEpoch,switches:this.switches,blockedTransitions:this.blockedTransitions,transition:untilBoundary<blendBeats?'preparing':null};
 }
}
