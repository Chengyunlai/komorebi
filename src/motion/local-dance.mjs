import {Vector3,Quaternion} from 'three'
import {buildPresentationOffsets,translateMotionPose} from './presentation-trajectory.mjs'
import {assessRootRecentring} from './root-recentring-assessment.mjs'
import {parseBVH,skeletonAt} from '../motion-lab/bvh.mjs'
import {createVRMRotationRetarget} from '../motion-lab/rotation-retarget.mjs'
import {capturePoseRecord,applyPoseRecord} from './motion-record.mjs'
import {createSourceAnkleTracker} from './source-ankle-tracker.mjs'
import {createMotionBank,MotionBankPlayer} from './motion-bank.mjs'
import {createBeatMotionBank,BeatStepPlayer} from './beat-steps.mjs'
const sides=['left','right'];
const midpoint=points=>new Vector3(...points.left).add(new Vector3(...points.right)).multiplyScalar(.5);
/** Compile source ankle trajectories in world metres; source units explicitly assume centimetres. */
export async function prepareLocalDance(vrm,text,cancelled=()=>false,{rootPolicy='in-place-feet-midpoint',collectRootDiagnostics=false,presentationWindowSeconds=2,full=false}={}){
 if(!['in-place-feet-midpoint','source-smoothed-presentation'].includes(rootPolicy))throw Error('Unknown root policy');
 const sourceWorld=rootPolicy==='source-smoothed-presentation',rootMode=sourceWorld?'source':'balance',rootTraces={source:[],adapter:[],socket:[],presentation:[]},socketShifts=[];
 const bvh=parseBVH(text),rest=capturePoseRecord(vrm),frames=[],contactFrames=[],fps=15,node=n=>vrm.humanoid.getNormalizedBoneNode(n),hips=node('hips'),origin=hips.position.clone();
 const index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i])),first=skeletonAt(bvh,0),sourceRight=new Vector3(...first.positions[index.UpperLeg_L]).sub(new Vector3(...first.positions[index.UpperLeg_R])),targetRight=node('leftUpperLeg').getWorldPosition(new Vector3()).sub(node('rightUpperLeg').getWorldPosition(new Vector3()));
 const poseSpace={hipsParentWorldMatrix:hips.parent.matrixWorld.toArray(),hipsRest:origin.toArray(),unit:'metre'};
 const yaw=Math.atan2(-targetRight.z,targetRight.x)-Math.atan2(-sourceRight.z,sourceRight.x);
 const sourcePoints=sample=>{const feet=Object.fromEntries(sides.map(side=>[side,new Vector3(...sample.positions[index[side==='left'?'Foot_L':'Foot_R']]).multiplyScalar(.01).toArray()])),center=sourceWorld?new Vector3():midpoint(feet);center.y=0;return {feet:Object.fromEntries(sides.map(side=>[side,new Vector3(...feet[side]).sub(center).toArray()])),socket:new Vector3(...sample.positions[index.UpperLeg_L]).add(new Vector3(...sample.positions[index.UpperLeg_R])).multiplyScalar(.005).sub(center).toArray()}};
 try{
  const adapter=createVRMRotationRetarget(vrm,bvh,{rootMode,worldAlignment:'y-up'}),sourceAdapter=collectRootDiagnostics&&!sourceWorld?createVRMRotationRetarget(vrm,bvh,{rootMode:'source',worldAlignment:'y-up'}):null,source0=sourcePoints(first);adapter.applyFrame(first);
  const tracker=createSourceAnkleTracker(vrm,{sourceToTargetYaw:yaw,sourceMetresToTargetMetres:adapter.scale/.01,sourceAnchor:source0.feet,targetAnchor:Object.fromEntries(sides.map(side=>[side,node(side+'Foot').getWorldPosition(new Vector3()).toArray()])),sourceSocketAnchor:source0.socket,targetSocketAnchor:node('leftUpperLeg').getWorldPosition(new Vector3()).add(node('rightUpperLeg').getWorldPosition(new Vector3())).multiplyScalar(.5).toArray(),maxRootShift:.3});
  for(let i=0;i<Math.floor(bvh.duration*fps);i++){
   if(cancelled())return null;const sample=skeletonAt(bvh,i/fps);
   if(sourceAdapter){sourceAdapter.applyFrame(sample);rootTraces.source.push(hips.getWorldPosition(new Vector3()).toArray())}
   const report=adapter.applyFrame(sample),source=sourcePoints(sample);
   if(collectRootDiagnostics||sourceWorld){rootTraces.adapter.push(hips.getWorldPosition(new Vector3()).toArray());if(sourceWorld)rootTraces.source.push(rootTraces.adapter.at(-1))}
   contactFrames.push({hips:report.sourceHips,feet:report.sourceFeet});const solved=tracker.apply(source.feet,{sourceSocketMidpoint:source.socket});
   if(collectRootDiagnostics||sourceWorld){rootTraces.socket.push(hips.getWorldPosition(new Vector3()).toArray());socketShifts.push({magnitude:solved.rootShiftMagnitude,clamped:solved.rootShiftClamped})}
   frames.push({rotations:Object.fromEntries(adapter.mappedBones.map(name=>[name,node(name).quaternion.toArray()])),hips:hips.position.clone().sub(origin).toArray(),feet:Object.fromEntries(sides.map(side=>[side,node(side+'Foot').getWorldPosition(new Vector3()).toArray()]))});
   if(i%30===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
 }finally{applyPoseRecord(vrm,rest)}
 if(cancelled())return null;
 if(sourceWorld){
  const offsets=buildPresentationOffsets(rootTraces.socket,{fps,windowSeconds:presentationWindowSeconds});
  for(let i=0;i<frames.length;i++){const shift=offsets[i].map(v=>-v);frames[i]=translateMotionPose(frames[i],shift,poseSpace);rootTraces.presentation.push(rootTraces.socket[i].map((v,k)=>v+shift[k]))}
 }else if(collectRootDiagnostics)rootTraces.presentation=rootTraces.socket;
 if(full){
  const player=createFullSegmentPlayer(frames,{fps,rootPolicy,poseSpace});player.bank.frames=frames;
  if(collectRootDiagnostics)player.bank.rootDiagnostics=summarizeCompilationRoots(rootTraces,{fps,rootMode,rootPolicy,presentationWindowSeconds,sourceScale:adapterScale(),socketShifts,clips:player.bank.clips});
  return player;
 }
 let player;try{player=new BeatStepPlayer(createBeatMotionBank(frames,{fps,contactFrames}))}catch(e){console.warn(e.message);player=new MotionBankPlayer(createMotionBank(frames,{fps}))}
 Object.assign(player.bank,{execution:'source-ankle/v1',worldAlignment:'y-up',rootPolicy,poseSpace});
 if(collectRootDiagnostics)player.bank.rootDiagnostics=summarizeCompilationRoots(rootTraces,{fps,rootMode,rootPolicy,presentationWindowSeconds,sourceScale:adapterScale(),socketShifts,clips:player.bank.clips});
 return player;
 function adapterScale(){const firstLeg=new Vector3(...first.positions[index.UpperLeg_L]).distanceTo(new Vector3(...first.positions[index.LowerLeg_L]))+new Vector3(...first.positions[index.LowerLeg_L]).distanceTo(new Vector3(...first.positions[index.Foot_L]));const targetLeg=node('leftUpperLeg').getWorldPosition(new Vector3()).distanceTo(node('leftLowerLeg').getWorldPosition(new Vector3()))+node('leftLowerLeg').getWorldPosition(new Vector3()).distanceTo(node('leftFoot').getWorldPosition(new Vector3()));return targetLeg/firstLeg}
}
export function applyLocalDance(vrm,pose,hipsRest){
 const weight=pose.weight;if(weight<=0)return;
 for(const [name,q] of Object.entries(pose.rotations)){const bone=vrm.humanoid.getNormalizedBoneNode(name);bone?.quaternion.slerp(new Quaternion().fromArray(q),weight)}
 const hips=vrm.humanoid.getNormalizedBoneNode('hips');hips.position.lerp(hipsRest.clone().add(new Vector3(...pose.hips)),weight);vrm.scene.updateMatrixWorld(true);
}
/** Stateless body solve; only landing telemetry remembers prior samples. */
export function createLocalDanceExecutor(vrm){
 const node=n=>vrm.humanoid.getNormalizedBoneNode(n),feet=()=>Object.fromEntries(sides.map(side=>[side,node(side+'Foot').getWorldPosition(new Vector3()).toArray()]));vrm.scene.updateMatrixWorld(true);
 const restFeet=feet(),zero={left:[0,0,0],right:[0,0,0]},tracker=createSourceAnkleTracker(vrm,{sourceToTargetYaw:0,sourceMetresToTargetMetres:1,sourceAnchor:zero,targetAnchor:zero});
 let epoch,raised={},previous={},lastLanding=null;
 return {apply(pose,hipsRest){
  const weight=Math.max(0,Math.min(1,Number.isFinite(pose.weight)?pose.weight:0));
  if(epoch!==pose.clockEpoch||weight===0){epoch=pose.clockEpoch;raised={};previous={};lastLanding=null}
  if(weight===0)return {mode:'off',desiredError:0,projectedCount:0,maxRotationRewriteRadians:0,ankleHeightsRelativeRest:Object.fromEntries(sides.map(s=>[s,feet()[s][1]-restFeet[s][1]])),lastLanding:null};
  const valid=sides.every(s=>Array.isArray(pose.feet?.[s])&&pose.feet[s].length===3&&pose.feet[s].every(Number.isFinite));
  if(!valid)throw Error('Local source trajectory requires two finite world ankle targets');
  vrm.scene.updateMatrixWorld(true);const before=feet();applyLocalDance(vrm,{...pose,weight},hipsRest);
  const targets=Object.fromEntries(sides.map(s=>[s,new Vector3(...before[s]).lerp(new Vector3(...pose.feet[s]),weight).toArray()])),report=tracker.apply(targets),after=feet(),heights=Object.fromEntries(sides.map(s=>[s,after[s][1]-restFeet[s][1]]));
  for(const side of sides){const h=heights[side];if(h>.06)raised[side]=true;if(raised[side]&&previous[side]>.025&&h<=.025&&weight>=.95&&Number.isFinite(pose.beat)){lastLanding={side,beat:pose.beat,clockEpoch:pose.clockEpoch,kind:'kinematic',offsetBeats:pose.beat-Math.round(pose.beat),trustedContact:false};raised[side]=false}previous[side]=h}
  return {...report,mode:'source-trajectory',desiredError:report.maxDesiredError,ankleHeightsRelativeRest:heights,lastLanding};
 }};
}

/** Fresh player for controlled in-page comparisons; source bank remains unchanged. */
export function createLocalDancePlayer(bank,options={}){
 if(!['legacy','coherent-lower-body','planned-lower-body'].includes(options.limiterMode??'legacy'))throw Error('Unknown local limiter mode');
 if(options.transitionPolicy==='heading-preroll'&&!bank.beatAligned)throw Error('Heading preroll requires beat-aligned material');
 return bank.beatAligned?new BeatStepPlayer(bank,options):new MotionBankPlayer(bank,options);
}

/**
 * Full-segment replay: sequentially plays every compiled source frame in order.
 * No beat-driven clip selection, no overlapping transitions, no slicing. The
 * daily executor (`createLocalDanceExecutor`) consumes the returned pose, so the
 * same Y-up source-ankle body execution applies to the complete dance.
 */
export function createFullSegmentPlayer(frames,{fps=15,rootPolicy='in-place-feet-midpoint',poseSpace={unit:'metre'},fadeInSeconds=.5,fadeOutSeconds=.5}={}){
 if(!Array.isArray(frames)||!frames.length)throw Error('Full segment requires compiled frames');
 let index=0,weight=0,clockEpoch=0,active=false,lastBeat=0;
 const bank={clips:[{id:0,start:0,end:frames.length-1,beats:null,anchors:[],activity:1}],beatAligned:false,worldAlignment:'y-up',rootPolicy,execution:'source-ankle/v1',poseSpace};
 return {
  bank,
  step({dt=1/30,active:on=false,beat=0,clockEpoch:epoch,bpm,timing}={}){
   if(epoch!==undefined&&Number.isFinite(epoch)&&epoch!==clockEpoch){clockEpoch=epoch;if(active)index=0}
   if(on&&!active){active=true;index=0;lastBeat=beat??0}
   if(!on&&active)active=false;
   if(on)weight=Math.min(1,weight+dt/Math.max(.05,fadeInSeconds));else weight=Math.max(0,weight-dt/Math.max(.05,fadeOutSeconds));
   if(active&&weight>0)index+=dt*fps;
   const frameIndex=Math.min(frames.length-1,Math.max(0,Math.floor(index))),frame=frames[frameIndex];
   return {...frame,weight,clockEpoch,beat:lastBeat+index/fps,clip:0,clipBeat:frameIndex/fps,sourceFrame:frameIndex,support:'double',timing:timing??'estimated',phaseError:0,transitionPolicy:'full-segment',switches:0,blockedTransitions:0,limiter:{mode:'full-segment'},source:{mode:weight>0?'audio':'waiting',primitive:'full-segment',bpm:Number.isFinite(bpm)?bpm:null}};
  }
 };
}

function summarizeCompilationRoots(traces,{fps,rootMode,rootPolicy,presentationWindowSeconds,sourceScale,socketShifts,clips}){
 const zero=[0,0,0],ranges=[{name:'continuous-9-48',start:Math.ceil(9*fps),end:Math.min(traces.socket.length-1,48*fps)},...clips.map(c=>({name:`clip-${c.id}`,start:c.start,end:c.end}))];
 const summarize=(points,range)=>{const selected=points.slice(range.start,range.end+1);if(selected.length<3)return null;const assessment=assessRootRecentring(selected.map((hips,i)=>({time:(range.start+i)/fps,hips,feet:{left:zero,right:zero}})));return {speed:assessment.speed.hips,acceleration:assessment.acceleration.hips,boundsXZ:{x:[Math.min(...selected.map(p=>p[0])),Math.max(...selected.map(p=>p[0]))],z:[Math.min(...selected.map(p=>p[2])),Math.max(...selected.map(p=>p[2]))]}}};
 return {schema:'compilation-root-stages/v1',scope:'Target WORLD horizontal roots at source compile grid; no music time warp or transition assessment',rootMode,rootPolicy,presentationWindowSeconds:rootPolicy==='source-smoothed-presentation'?presentationWindowSeconds:null,sourceUnitMetres:.01,sourceUnitsToTargetMetres:sourceScale,fps,frameCount:traces.socket.length,socketCorrection:{count:socketShifts.length,maxMetres:Math.max(0,...socketShifts.map(s=>s.magnitude)),clampedCount:socketShifts.filter(s=>s.clamped).length},ranges:ranges.map(range=>({...range,stages:Object.fromEntries(Object.entries(traces).map(([name,points])=>[name,summarize(points,range)]))}))};
}
