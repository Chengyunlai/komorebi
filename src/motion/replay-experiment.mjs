import {Quaternion,Vector3} from 'three'
import {skeletonAt} from '../motion-lab/bvh.mjs'
import {createVRMRotationRetarget} from '../motion-lab/rotation-retarget.mjs'
import {createVRMRetarget} from '../motion-lab/vrm-retarget.mjs'
import {createContactPlant} from './contact-plant.mjs'
import {analyzeFootContacts} from './contact-analysis.mjs'
import {createBodyProfile,capturePoseRecord,applyPoseRecord,comparePoseRecords} from './motion-record.mjs'
import {captureSourceRecord} from './source-record.mjs'
const clone=value=>JSON.parse(JSON.stringify(value));
function blendWithRest(rest,record,weight){
 const result=clone(record);result.stage='blend';
 for(const [name,joint] of Object.entries(result.joints)){const base=rest.joints[name];joint.rotation=new Quaternion().fromArray(base.rotation).slerp(new Quaternion().fromArray(joint.rotation),weight).toArray();joint.position=base.position.map((v,i)=>v+(joint.position[i]-v)*weight)}
 const hips=result.joints[result.root.bone];result.root={bone:result.root.bone,position:[...hips.position],rotation:[...hips.rotation]};return result;
}
function captureSecondary(vrm){return [...(vrm.springBoneManager?.joints||[])].map((joint,index)=>({id:`${index}:${joint.bone?.name||'spring'}`,position:joint.bone?.position.toArray(),rotation:joint.bone?.quaternion.toArray()}))}
function measureDirections(vrm,report){
 const perBone={},ends={leftUpperArm:'leftLowerArm',leftLowerArm:'leftHand',rightUpperArm:'rightLowerArm',rightLowerArm:'rightHand',leftUpperLeg:'leftLowerLeg',leftLowerLeg:'leftFoot',rightUpperLeg:'rightLowerLeg',rightLowerLeg:'rightFoot'};
 vrm.scene.updateMatrixWorld(true);
 for(const [name,end] of Object.entries(ends)){const a=vrm.humanoid.getRawBoneNode?.(name)||vrm.humanoid.getNormalizedBoneNode(name),b=vrm.humanoid.getRawBoneNode?.(end)||vrm.humanoid.getNormalizedBoneNode(end);if(a&&b&&report.directions[name])perBone[name]=b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3())).normalize().angleTo(new Vector3(...report.directions[name]))}
 return {perBone,maxRadians:Math.max(0,...Object.values(perBone)),scope:'bone direction only; excludes twist, skinning and expression'};
}
/** A deterministic fixed-step body experiment; does not control the desktop pet. */
export function createReplayExperiment(vrm,bvh,{bodyId='vrm-local'}={}){
 const profile=createBodyProfile(vrm,{id:bodyId}),rest=capturePoseRecord(vrm,{time:0,stage:'rest',bodyId});
 const adapters=Object.fromEntries(['height','source','balance'].map(rootMode=>[rootMode,createVRMRetarget(vrm,bvh,{rootMode})]));
 const rotationAdapters=Object.fromEntries(['height','source','balance'].map(rootMode=>[rootMode,createVRMRotationRetarget(vrm,bvh,{rootMode})]));
 profile.retargetModes={direction:true,rotation:rotationAdapters.height.available,calibration:rotationAdapters.height.calibration};
 const index=Object.fromEntries(bvh.joints.map((j,i)=>[j.name,i])),scaleToMetres=adapters.height.scale;
 const frames=Array.from({length:bvh.frameCount},(_,i)=>{const {positions:p}=skeletonAt(bvh,i*bvh.frameTime);return {hips:p[index.Hips].map(v=>v*scaleToMetres),feet:{left:p[index.Foot_L].map(v=>v*scaleToMetres),right:p[index.Foot_R].map(v=>v*scaleToMetres)}}});
 const contact=analyzeFootContacts(frames,{fps:1/bvh.frameTime});let cursor=-1,key=null,plant,lastTrace,lastReport,lastDirectionError;
 const capture=(time,stage)=>capturePoseRecord(vrm,{time,stage,sourceTime:time,bodyId});
 function reset(){applyPoseRecord(vrm,rest);vrm.humanoid.update?.();vrm.scene.updateMatrixWorld(true);vrm.springBoneManager?.reset();plant=createContactPlant(vrm);cursor=-1}
 function advance(frame,options){
  const time=frame*bvh.frameTime,report=(options.retargetMode==='rotation'?rotationAdapters:adapters)[options.rootMode].apply(time),retarget=capture(time,'retarget');
  vrm.humanoid.update?.();vrm.scene.updateMatrixWorld(true);
  const rotationResidual=rotationAdapters[options.rootMode].measure(time);
  lastDirectionError=measureDirections(vrm,report);
  const blend=blendWithRest(rest,retarget,options.blendWeight);applyPoseRecord(vrm,blend);
  let constraints=null;if(options.constraints){const feet=frames[frame].feet;constraints=plant.apply({weight:1,contacts:contact.frames[frame],footHeights:Object.fromEntries(['left','right'].map(side=>[side,Math.max(0,feet[side][1]-contact.diagnostics.groundHeight)]))})}
  const constrained=capture(time,'constrained');vrm.update(options.physics&&frame>0?bvh.frameTime:0);const final=capture(time,'final');
  const finalRotationResidual=rotationAdapters[options.rootMode].measure(time),finalDirections=measureDirections(vrm,report);
  final.secondary={enabled:options.physics,scope:'humanoid comparisons exclude spring-bone motion',joints:options.physics?captureSecondary(vrm):[]};
  lastReport=report;lastTrace={schema:'motion-trace/v1',time,source:captureSourceRecord(bvh,time,{scaleToMetres}),retarget,blend,constrained,final,rotationResidual,finalRotationResidual,finalDirections,sourceMapping:{method:options.retargetMode==='rotation'?'calibrated source world-rotation delta':'bone-direction',calibrationTime:0,mappedBones:options.retargetMode==='rotation'?rotationAdapters[options.rootMode].mappedBones:adapters[options.rootMode].mappedBones,absoluteInitialTwist:'unknown'},contact:{method:contact.diagnostics.method,estimated:contact.frames[frame],constraintReport:constraints},options};cursor=frame;
 }
 function evaluate({time=0,rootMode='height',retargetMode='direction',blendWeight=1,constraints=false,physics=false,music=null}={}){
  if(!Number.isFinite(time)||time<0||!adapters[rootMode]||!['direction','rotation'].includes(retargetMode)||!Number.isFinite(blendWeight)||blendWeight<0||blendWeight>1)throw Error('回放时间、根运动策略或混合权重无效');
  const options={rootMode,retargetMode,blendWeight,constraints:Boolean(constraints),physics:Boolean(physics),history:'fixed-step-from-source-start',frameTime:bvh.frameTime},nextKey=JSON.stringify(options),frame=Math.min(bvh.frameCount-1,Math.floor(time/bvh.frameTime+1e-8));
  if(nextKey!==key||frame<cursor||(options.physics&&frame===cursor)){reset();key=nextKey}
  if(frame===cursor){applyPoseRecord(vrm,lastTrace.final);vrm.humanoid.update?.()}else for(let i=cursor+1;i<=frame;i++)advance(i,options);
  const trace=clone(lastTrace);trace.requestedTime=time;trace.music=music===null?null:clone(music);trace.musicRole='recorded observation only; no choreography is generated by this baseline';trace.clocks={sourceSeconds:trace.time,musicSeconds:Number.isFinite(music?.sampleFrame)&&music?.sampleRate>0?music.sampleFrame/music.sampleRate:null,relationship:'unmapped; these are independent recorded clocks'};
  return {trace,profile,sourceDirectionsError:{...clone(lastDirectionError),final:clone(trace.finalDirections)},sourceMapping:{mappedBones:lastReport.bones,method:retargetMode==='rotation'?'calibrated source world-rotation delta':'bone-direction, twist not reconstructed',calibration:rotationAdapters[rootMode].calibration,rotationResidual:trace.rotationResidual},changes:{blend:comparePoseRecords(trace.retarget,trace.blend),constrained:comparePoseRecords(trace.blend,trace.constrained),final:comparePoseRecords(trace.constrained,trace.final)}};
 }
 return {profile,evaluate,source:{frameTime:bvh.frameTime,frameCount:bvh.frameCount,lastSampleTime:(bvh.frameCount-1)*bvh.frameTime}};
}
