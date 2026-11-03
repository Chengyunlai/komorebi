import {Vector3,Quaternion} from 'three'
import {MusicAnalyzer} from '../../electron/vendor/music-signal/analyzer.mjs'
import {demoBlock} from '../../electron/vendor/music-signal/demo-audio.mjs'
import {VRMDanceController} from './vrm-dance.mjs'
import {MotionBankPlayer} from './motion-bank.mjs'
import {BeatStepPlayer} from './beat-steps.mjs'
import {applyLocalDance,createLocalDanceExecutor} from './local-dance.mjs'
import {capturePoseRecord,applyPoseRecord} from './motion-record.mjs'
const sides=['left','right']
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))
const accumulator=()=>({values:[],worst:null})
function add(metric,value,context){if(!Number.isFinite(value))throw Error('Limiter assessment encountered a non-finite metric');metric.values.push(value);if(!metric.worst||value>metric.worst.value)metric.worst={value,...context}}
function summary(metric){const a=metric.values,sorted=[...a].sort((a,b)=>a-b);return {count:a.length,max:a.length?sorted.at(-1):null,p95:a.length?sorted[Math.floor((a.length-1)*.95)]:null,mean:a.length?a.reduce((a,b)=>a+b,0)/a.length:null,worst:metric.worst}}
const abort=signal=>{if(signal?.aborted){const e=new Error('Limiter assessment cancelled');e.name='AbortError';throw e}}
/** Fixed PCM/sample-clock counterfactuals. Returns aggregates only, never source poses. */
export async function assessDailyLimiterStages(vrm,bank,{hipsRest,signal,onProgress,duration=27,fps=30,transitionPolicy='static',transitionBeats=.3}={}){
 if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(fps)||fps<10||fps>240)throw new TypeError('Invalid limiter assessment duration or fps')
 if(!vrm?.humanoid?.resetNormalizedPose||!vrm?.scene?.updateMatrixWorld)throw Error('Limiter assessment requires a normalized VRM humanoid with resetNormalizedPose')
 for(const name of ['hips',...sides.flatMap(s=>[s+'UpperLeg',s+'LowerLeg',s+'Foot'])])if(!vrm.humanoid.getNormalizedBoneNode(name))throw Error(`Limiter assessment anatomy missing normalized ${name}`)
 if(!bank?.clips?.length||!bank.frames?.length)throw Error('Limiter assessment requires a prepared motion bank')
 if(!Number.isFinite(transitionBeats)||transitionBeats<=0||transitionBeats>1)throw TypeError('Limiter assessment transitionBeats must be finite and greater than zero, at most one beat')
 if(!['static','heading-preroll'].includes(transitionPolicy))throw TypeError('Unknown limiter assessment transition policy')
 if(transitionPolicy==='heading-preroll'&&!bank.beatAligned)throw Error('heading-preroll transition policy requires a beat-aligned motion bank')
 const rest=hipsRest?.isVector3?hipsRest.clone():Array.isArray(hipsRest)&&hipsRest.length===3&&hipsRest.every(Number.isFinite)?new Vector3(...hipsRest):null
 if(!rest||![rest.x,rest.y,rest.z].every(Number.isFinite))throw TypeError('Limiter assessment requires finite hipsRest Vector3 or array')
 const saved=capturePoseRecord(vrm),Player=bank.beatAligned?BeatStepPlayer:MotionBankPlayer,legacy=new Player(bank,{limiterMode:'legacy',traceStages:true,transitionPolicy,transitionBeats}),coherent=new Player(bank,{limiterMode:'coherent-lower-body',traceStages:true,transitionPolicy,transitionBeats}),planned=new Player(bank,{limiterMode:'planned-lower-body',traceStages:true,transitionPolicy,transitionBeats}),dance=new VRMDanceController(),sampleRate=24000,analyzer=new MusicAnalyzer({sampleRate,featureHz:30,streamId:'daily-limiter-assessment'}),dt=1/fps
 const metrics=['fkDesiredError','desiredError','maxRotationRewriteRadians','projectedCount','projectedDistance','finalLowerBodyAngularSpeed','finalHipSpeed'],stages=Object.fromEntries(['rawSample','preBlend','legacyLimited','coherentLimited','plannedLowerBody'].map(name=>[name,Object.fromEntries(metrics.map(m=>[m,accumulator()]))])),lag=accumulator(),factor=accumulator(),plannedLag=accumulator(),previousSolved={},lowerBody=['hips',...sides.flatMap(side=>[side+'UpperLeg',side+'LowerLeg',side+'Foot',side+'Toes'])]
 let sampleFrame=0,latest=null,sourceFeatureCount=0,samplesFullWeight=0,planFingerprint=2166136261
 const reset=()=>{vrm.humanoid.resetNormalizedPose();vrm.humanoid.getNormalizedBoneNode('hips').position.copy(rest);vrm.scene.updateMatrixWorld(true)}
 try{
  reset();createLocalDanceExecutor(vrm) // Validate leg lengths and world anatomy before expensive sampling.
  for(let frame=0;frame<Math.ceil(duration*fps);frame++){
   abort(signal)
   const target=Math.min(Math.floor(duration*sampleRate),Math.round((frame+1)*sampleRate/fps))
   while(sampleFrame<target){const count=Math.min(800,target-sampleFrame),packets=analyzer.push({mono:demoBlock(sampleFrame,count,sampleRate),startFrame:sampleFrame});sampleFrame+=count;for(const packet of packets)if(packet.type==='features'){latest=packet;sourceFeatureCount++}}
   const time=sampleFrame/sampleRate,signalAge=latest?Math.max(0,(sampleFrame-latest.sampleFrame)/sampleRate):Infinity,music=dance.step({dt,signal:latest,signalAge,audioMode:true,enabled:true}),source=music.source,active=source.mode==='audio'&&source.primitive!=='rest',input={dt,active,bpm:source.bpm,energy:latest?.energy??0,beat:source.beat,clockEpoch:source.clockEpoch,timing:source.timing},a=legacy.step(input),b=coherent.step(input),c=planned.step(input)
   const sourceFrame=a.sourceFrame??(bank.clips[a.clip].start+legacy.time*bank.fps)
   for(const char of `${a.clip}:${sourceFrame}:${a.beat??source.beat};`){planFingerprint=Math.imul(planFingerprint^char.charCodeAt(0),16777619)>>>0}
   if([b,c].some(p=>a.clip!==p.clip||a.sourceFrame!==p.sourceFrame||a.beat!==p.beat||a.switches!==p.switches))throw Error('Limiter invariant failed: counterfactual player clocks or clip selections diverged')
   if(a.weight>=.999&&active&&latest&&!['silent','lost'].includes(latest.state)){
    if(!legacy.lastStages||!coherent.lastStages||!planned.lastStages)throw Error('Limiter assessment requires player traceStages instrumentation')
    samplesFullWeight++;const context={time,clip:a.clip,sourceFrame:a.sourceFrame??(bank.clips[a.clip].start+legacy.time*bank.fps),transition:a.transition??null}
    const poses={rawSample:legacy.lastStages.sample,preBlend:legacy.lastStages.blended,legacyLimited:legacy.lastStages.limited,coherentLimited:coherent.lastStages.limited,plannedLowerBody:planned.lastStages.limited}
    for(const [name,stage] of Object.entries(poses)){
     if(!stage?.feet||!sides.every(s=>stage.feet[s]?.length===3&&stage.feet[s].every(Number.isFinite)))throw Error(`Limiter assessment ${name} lacks world ankle targets`)
     const pose={...stage,weight:1,clockEpoch:source.clockEpoch,beat:source.beat}
     reset();applyLocalDance(vrm,pose,rest);const perSide=Object.fromEntries(sides.map(s=>[s,distance(vrm.humanoid.getNormalizedBoneNode(s+'Foot').getWorldPosition(new Vector3()).toArray(),pose.feet[s])]))
     add(stages[name].fkDesiredError,Math.max(...Object.values(perSide)),{...context,perSide})
     reset();const executor=createLocalDanceExecutor(vrm),report=executor.apply(pose,rest)
     for(const [key,value] of Object.entries({desiredError:report.desiredError,maxRotationRewriteRadians:report.maxRotationRewriteRadians,projectedCount:report.projectedCount,projectedDistance:report.maxProjectedDistance}))add(stages[name][key],value,{...context,perSide:report.perSide})
     const solved=capturePoseRecord(vrm),current=Object.fromEntries(lowerBody.filter(bone=>solved.joints[bone]).map(bone=>[bone,solved.joints[bone].rotation])),previous=previousSolved[name],hipsWorld=vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new Vector3()).toArray()
     if(previous&&previous.frame===frame-1){let maximum=0,worstBone=null;for(const [bone,q] of Object.entries(current)){if(!previous.rotations[bone])continue;const speed=new Quaternion().fromArray(q).angleTo(new Quaternion().fromArray(previous.rotations[bone]))/dt;if(speed>maximum){maximum=speed;worstBone=bone}}add(stages[name].finalLowerBodyAngularSpeed,maximum,{...context,bone:worstBone});add(stages[name].finalHipSpeed,distance(hipsWorld,previous.hipsWorld)/dt,context)}
     previousSolved[name]={frame,rotations:current,hipsWorld}
    }
    const perSide=Object.fromEntries(sides.map(s=>[s,distance(poses.preBlend.feet[s],poses.coherentLimited.feet[s])]))
    add(lag,Math.max(...Object.values(perSide)),{...context,perSide})
    const plannedPerSide=Object.fromEntries(sides.map(s=>[s,distance(poses.preBlend.feet[s],poses.plannedLowerBody.feet[s])]))
    add(plannedLag,Math.max(...Object.values(plannedPerSide)),{...context,perSide:plannedPerSide})
    const shared=b.limiter?.factor
    if(!Number.isFinite(shared))throw Error('Coherent limiter did not report a finite shared factor')
    add(factor,shared,context)
   }else{for(const key of Object.keys(previousSolved))delete previousSolved[key]}
   if(frame%30===29){onProgress?.({frame:frame+1,totalFrames:Math.ceil(duration*fps),time,samplesFullWeight});await new Promise(resolve=>setTimeout(resolve,0))}
  }
  if(!samplesFullWeight)throw Error('Limiter assessment produced no active full-weight samples')
  return {schema:'daily-limiter-assessment/v1',transitionPolicy,transitionBeats,planFingerprint,duration,fps,sampleRate,sourceFeatureCount,samplesFullWeight,clocksIdentical:true,stages:Object.fromEntries(Object.entries(stages).map(([name,group])=>[name,Object.fromEntries(Object.entries(group).map(([key,value])=>[key,summary(value)]))])),coherentLag:{targetDistance:summary(lag),sharedFactor:summary(factor)},plannedLag:{targetDistance:summary(plannedLag)},units:{distance:'metres',rotation:'radians',hipSpeed:'metres/second (world, post-IK, consecutive full-weight samples only)',angularSpeed:'radians/second (normalized local, consecutive full-weight samples only)',time:'seconds'},contacts:{knowledge:'unknown',planted:false},limitations:['Counterfactual stage evaluation resets the same normalized rig baseline at full weight.','Target lag measures coherent ankle targets against the pre-limiter desired trajectory; reduced IK rewrite alone does not demonstrate improved tracking.','No timing synchronization, trusted contact, floor contact or foot-slip claim is made.']}
 }finally{applyPoseRecord(vrm,saved);vrm.update?.(0)}
}
