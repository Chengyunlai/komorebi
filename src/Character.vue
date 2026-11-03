<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm'
import {createFootPlant} from './motion/foot-ik.mjs'
import {defaultIdleMotion} from './motion/default-idle.mjs'
import {VRMIdleController} from './motion/vrm-idle.mjs'
import {prepareLocalDance,createLocalDanceExecutor,createLocalDancePlayer} from './motion/local-dance.mjs'
import {capturePoseRecord,applyPoseRecord} from './motion/motion-record.mjs'
import {assessDailyLimiterStages} from './motion/daily-limiter-assessment.mjs'
import {VRMDanceController} from './motion/vrm-dance.mjs'
import {parseBVH} from './motion-lab/bvh.mjs'
import {buildSourceMotionMaterial} from './motion/source-material.mjs'
import {annotateDanceStructure} from './motion/dance-structure.mjs'
import {planDancePhrases} from './motion/dance-planner.mjs'
import {createPlannedPhrasePlayer} from './motion/planned-phrase-player.mjs'
import {createFreestyleMotionPlayer} from './motion/freestyle-motion.mjs'
import {createContinuousGroove} from './motion/continuous-groove.mjs'
import {createReliabilityMonitor,createReliabilityGate} from './motion/music-reliability.mjs'
const props=defineProps({active:Boolean,pet:Boolean,behavior:Object,music:Object,audio:Object,danceEnabled:{type:Boolean,default:true},tempo:{type:Number,default:100},fullReplay:{type:Boolean,default:false},reliabilityGate:{type:Boolean,default:false}})
const emit=defineEmits(['touch','ready','dance-frame']);const host=ref(null),loading=ref(true),error=ref('');
let reliabilityMonitor,reliabilityGate,reliability={mode:'reactive',reason:'disabled'},lastOnsetFrameRef=null,plannedMaterial,plannedStructure,referenceText,danceStreamQueue=[],danceStreamPlayhead=0,danceStreamWeight=0,danceStreamSilentFor=0,removeDanceStream,danceRetarget=null,grooveEngine,grooveClock=0,grooveBpm=120,danceLibraryFrames=null,diagnosingLimiter=false,lastDanceReport=0,localExecutor,localExecutionReport,localDance,localPose,idle,lastIdleReport=0,footPlant,footError=0,renderer,scene,camera,vrm,observer,raf,last=0,elapsed=0,disposed=false,removeSpeech,removeMusicAudio,musicAudio,audio,audioContext,analyser,audioSource,samples,hipsRest,viewHeight=2.2,lastRender=0,lastReport=0,frames=0;
const dance=new VRMDanceController(),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
reliabilityMonitor=createReliabilityMonitor();reliabilityGate=createReliabilityGate();
function fit(){if(!renderer)return;const {width,height}=host.value.getBoundingClientRect();if(width<1||height<1)return;renderer.setSize(width,height);const vertical=Math.max(viewHeight,viewHeight*.72/(width/height));camera.left=-vertical*width/height/2;camera.right=-camera.left;camera.top=vertical/2;camera.bottom=-vertical/2;camera.updateProjectionMatrix()}
async function speech(data){audio?.pause();audioSource?.disconnect();if(data.stop||!data.audio)return;try{audioContext||=new AudioContext();await audioContext.resume();analyser=audioContext.createAnalyser();analyser.fftSize=256;samples=new Uint8Array(analyser.fftSize);audio=new Audio(data.audio);audioSource=audioContext.createMediaElementSource(audio);audioSource.connect(analyser);analyser.connect(audioContext.destination);await audio.play()}catch(e){console.error('VRM speech playback',e)}}
function tick(now){if(disposed)return;raf=requestAnimationFrame(tick);if(diagnosingLimiter)return;const fps=document.hidden?4:30;if(now-lastRender<1000/fps)return;lastRender=now;const dt=last?Math.min((now-last)/1000,.1):1/30;last=now;elapsed+=dt;if(!vrm)return;
 const audioMode=['demo','netease','system'].includes(props.audio?.mode),enabled=props.danceEnabled&&!reduced.matches;
 if(props.reliabilityGate){const signal=props.audio?.signal;if(signal)reliabilityMonitor.push({time:elapsed,state:signal.state,confidence:signal.tempo?.confidence??null,bpm:signal.tempo?.bpm??null});const judgement=reliabilityMonitor.judge();const mode=reliabilityGate.push(judgement,elapsed);reliability={mode,reason:judgement.reason,trackingRatio:judgement.trackingRatio,confidenceMedian:judgement.confidenceMedian}}
 let pose=dance.step({dt,audioMode,signal:props.audio?.signal,signalAge:props.audio?.receivedAt===undefined?Infinity:(performance.now()-props.audio.receivedAt)/1000,enabled,style:props.behavior?.choice||'default',preview:['gentle','energetic'].includes(props.behavior?.choice)||props.music?.preview,tempo:props.tempo});
 const plannedActive=props.reliabilityGate?reliability.mode==='beat-aligned':true;
 const onsetFrame=props.audio?.signal?.lastOnsetFrame,newOnset=onsetFrame!==undefined&&onsetFrame!==lastOnsetFrameRef;
 if(newOnset)lastOnsetFrameRef=onsetFrame;
 const grooveActive=false;
 if(!grooveActive&&localDance)localPose=localDance.step({dt,active:props.fullReplay||(plannedActive&&enabled&&['audio','preview'].includes(pose.source.mode)&&pose.source.primitive!=='rest'),beat:pose.source.beat,clockEpoch:pose.source.clockEpoch,timing:pose.source.timing,bpm:pose.source.bpm,energy:props.audio?.signal?.energy??.5,onset:newOnset,accent:pose.source.accent??0});
 if(idle)pose=idle.step({dt,pose,reducedMotion:reduced.matches});
 const danceStreamActive=stepDanceStream(dt);
 if(!danceStreamActive&&!grooveActive){vrm.humanoid.resetNormalizedPose();for(const [name,angles] of Object.entries(pose.rotations)){const node=vrm.humanoid.getNormalizedBoneNode(name);if(node){const [x,y,z]=angles;const sign=vrm.meta.metaVersion==='0'?-1:1;node.quaternion.setFromEuler(new THREE.Euler(x*sign,y,z*sign,'XYZ'))}}
 const hips=vrm.humanoid.getNormalizedBoneNode('hips');const shift=new THREE.Vector3(pose.hips[0]*(footPlant?.lateralSign||1),pose.hips[1],pose.hips[2]).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());hips.position.copy(hipsRest).add(shift);}
 // Breathing and blinking are idle gestures, independent of audio choreography.
 const chest=vrm.humanoid.getNormalizedBoneNode('chest');if(chest&&!reduced.matches)chest.rotation.x+=Math.sin(elapsed*1.8)*.008*(1-(pose.idle?.weight||0));
 const blink=elapsed%4.7;vrm.expressionManager?.setValue('blink',(blink<.15?Math.sin(blink/.15*Math.PI):0)*(1-(pose.idle?.weight||0)));
 for(const [name,value] of Object.entries(pose.expressions||{}))vrm.expressionManager?.setValue(name,value);
 if(vrm.lookAt&&pose.look){vrm.lookAt.yaw=pose.look.yaw;vrm.lookAt.pitch=pose.look.pitch}
 let mouth=0;if(analyser&&audio&&!audio.paused){analyser.getByteTimeDomainData(samples);mouth=Math.min(1,Math.sqrt(samples.reduce((sum,v)=>sum+((v-128)/128)**2,0)/samples.length)*5)}vrm.expressionManager?.setValue('aa',mouth);
 // Keep thigh lift within a modest range: exaggerated raises drag the skirt mesh and look wrong.
 const identityQ=new THREE.Quaternion();
 for(const side of ['left','right']){
  const leg=vrm.humanoid.getNormalizedBoneNode(side+'UpperLeg');
  if(!leg)continue;
  const angle=leg.quaternion.angleTo(identityQ);
  if(angle>1.4)leg.quaternion.slerp(identityQ,1-1.4/angle);
  // Knees may bend freely; only the thigh raise drags the skirt.
  const knee=vrm.humanoid.getNormalizedBoneNode(side+'LowerLeg');
  if(knee){const kneeAngle=knee.quaternion.angleTo(identityQ);if(kneeAngle>2.6)knee.quaternion.slerp(identityQ,1-2.6/kneeAngle)}
 }
 vrm.scene.updateMatrixWorld(true);footError=localPose?.weight>0?0:footPlant?.apply(pose.feet)||0;if(localPose){localExecutionReport=localExecutor.apply(localPose,hipsRest);footError=localExecutionReport.desiredError??footError;host.value.dataset.danceClip=String(localPose.clip);host.value.dataset.danceWeight=localPose.weight.toFixed(3);
 Object.assign(host.value.dataset,{danceExecution:localExecutionReport.mode,danceWorldAlignment:localDance.bank.worldAlignment||'unknown',danceBeat:Number(localPose.beat||0).toFixed(3),danceSupport:localPose.support||'unknown',danceTiming:localPose.timing||'estimated',dancePhaseError:Number(localPose.phaseError||0).toFixed(4),danceSourceFrame:Number(localPose.sourceFrame||0).toFixed(2)});
 if(now-lastDanceReport>500){lastDanceReport=now;const report={available:Boolean(localDance.bank.beatAligned),weight:localPose.weight,clip:localPose.clip,beat:localPose.beat,clipBeat:localPose.clipBeat,sourceFrame:localPose.sourceFrame,support:localPose.support,timing:localPose.timing,phaseError:localPose.phaseError,clockEpoch:localPose.clockEpoch,switches:localPose.switches,blockedTransitions:localPose.blockedTransitions,contactError:null,contactLocked:0,contactSkipped:0,contactRejected:0,footHeights:localExecutionReport.ankleHeightsRelativeRest,lastLanding:localExecutionReport.lastLanding,contactMethod:'source-kinematic-estimate-no-lock',musicBpm:pose.source.bpm,motionSource:pose.source.mode,sourcePrimitive:pose.source.primitive,signalStream:props.audio?.signal?.streamId,signalSampleFrame:props.audio?.signal?.sampleFrame,execution:{...localExecutionReport,worldAlignment:localDance.bank.worldAlignment,rootPolicy:localDance.bank.rootPolicy,bankExecution:localDance.bank.execution,limiter:localPose.limiter,transitionPolicy:localPose.transitionPolicy,legacyContactApplied:false,finalWriter:localPose.weight>0?'source-trajectory-executor':'procedural-idle'},clips:localDance.bank.clips.map(({id,start,end,beats,anchors,activity})=>({id,start,end,beats,anchors,activity})),planned:localPose.plan??null,reliability:props.reliabilityGate?reliability:null};emit('dance-frame',report);if(props.pet)window.komorebi.danceStudyReport(report).catch(()=>{})}}vrm.update(dt);renderer.render(scene,camera);frames++;
 if(props.pet&&pose.idle&&now-lastIdleReport>750){lastIdleReport=now;window.komorebi.idleMotionReport({...pose.idle,head:pose.rotations.head,body:pose.rotations.spine}).catch(()=>{})}
 if(props.pet&&now-lastReport>500&&(audioMode||['gentle','energetic','stop'].includes(props.behavior?.choice))){lastReport=now;const p=pose.source;window.komorebi.musicMotionReport({renderer:'vrm',motionMode:p.mode,primitive:p.primitive,eventCount:p.eventCount||0,behavior:props.behavior?.choice,streamId:props.audio?.signal?.streamId||'behavior-'+(props.behavior?.choice||'default'),audioTime:(props.audio?.signal?.sampleFrame||0)/(props.audio?.signal?.sampleRate||48000),strength:p.strength||0,enabled,reducedMotion:reduced.matches,naturalCalls:frames,values:{headX:p.headX||0,headY:p.headY||0,headZ:p.headZ||0,bodyX:p.bodyX||0,bodyZ:p.bodyZ||0,leftArm:p.leftArm||0,rightArm:p.rightArm||0,rootAngle:0},phrase:{beat:p.beat,phase:p.phrasePhase,bpm:p.bpm,support:p.support,timing:p.timing,musicalMode:p.musicalMode,arrangement:p.arrangement,accent:p.accent},clipCount:p.clipCount||0,footError,joints:{leftElbow:pose.rotations.leftLowerArm[1],rightElbow:pose.rotations.rightLowerArm[1],leftKnee:vrm.humanoid.getNormalizedBoneNode('leftLowerLeg').quaternion.angleTo(new THREE.Quaternion()),rightKnee:vrm.humanoid.getNormalizedBoneNode('rightLowerLeg').quaternion.angleTo(new THREE.Quaternion())}}).catch(()=>{})}
}
onMounted(async()=>{try{console.info('[boot] mounted')
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setClearColor(0,0);renderer.setPixelRatio(devicePixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;host.value.prepend(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1.1,-1.1,.1,20);scene.add(new THREE.HemisphereLight(0xffffff,0xb2bed0,1.8));const light=new THREE.DirectionalLight(0xffffff,1.8);light.position.set(1,3,3);scene.add(light);
 console.info('[boot] requesting avatar');const resource=await window.komorebi.motionAvatar();console.info('[boot] avatar bytes',resource?.bytes?.byteLength);if(!resource)throw Error('请先在配置与管理中导入 VRM 角色。');if(disposed)return;
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const bytes=resource.bytes;console.info('[boot] parsing vrm');const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');vrm=gltf.userData.vrm;if(disposed){VRMUtils.deepDispose(vrm.scene);return}console.info('[boot] vrm parsed');VRMUtils.rotateVRM0(vrm);scene.add(vrm.scene);vrm.scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(vrm.scene),height=bounds.max.y-bounds.min.y;viewHeight=height*1.35;camera.position.set(0,(bounds.max.y+bounds.min.y)/2,4);camera.lookAt(0,camera.position.y,0);hipsRest=vrm.humanoid.getNormalizedBoneNode('hips').position.clone();footPlant=createFootPlant(vrm);localExecutor=createLocalDanceExecutor(vrm);fit();observer=new ResizeObserver(fit);observer.observe(host.value);
 if(props.pet){removeDanceStream=window.komorebi.on('dance-stream',segment=>{try{setupDanceRetarget();applyDanceJoints(segment.joints,segment.frames)}catch(error){console.warn('dance stream segment failed',error.message)}});removeSpeech=window.komorebi.on('speech',speech);removeMusicAudio=window.komorebi.on('music-audio',data=>{musicAudio?.pause();musicAudio=null;if(data.type==='demo'){musicAudio=new Audio(data.audio);musicAudio.volume=.3;musicAudio.play().then(()=>window.komorebi.musicAudioReady()).catch(()=>window.komorebi.musicAudioStop())}})}
 // Original idle is always available; locally installed Hiyori remains an optional study.
 let idleSource=defaultIdleMotion;
 try{const response=await fetch(new URL('./vendor/hiyori_free_zh/runtime/motion/hiyori_m05.motion3.json',location.href));if(response.ok){idleSource=await response.json();idleSource.Meta.Source='hiyori_m05'}}catch{}
 idle=new VRMIdleController(idleSource);if(disposed)return;
 // Optional local reference failure must not prevent the pet from starting.
 console.info('[boot] requesting reference');try{const reference=await window.komorebi.motionReference();console.info('[boot] reference',reference?.text?.length);if(reference?.text){referenceText=reference.text;
  if(props.pet){
   // Daily dancer: motion-matching freestyle over the compiled real-dance library.
   grooveEngine=createContinuousGroove({seed:(Date.now()%100000)+1});
  try{const library=await window.komorebi.danceLibrary();if(library?.available&&library.frames?.length>=600){danceLibraryFrames=library.frames;console.info('[dance] real-dance library',library.clips.length,'clips,',library.frames.length,'frames')}}catch(error){console.warn('[dance] library load failed',error.message)}
  const compiled=await prepareLocalDance(vrm,referenceText,()=>disposed,{full:true});
   const compiledFrames=compiled?.bank?.frames;
   const playbackFrames=danceLibraryFrames?.length?danceLibraryFrames:compiledFrames;
   if(playbackFrames?.length)localDance=createFreestyleMotionPlayer(playbackFrames,{fps:15,segmentSeconds:2.4,crossfadeSeconds:.6});
   else localDance=compiled;
  }else localDance=await prepareLocalDance(vrm,referenceText,()=>disposed)}}catch(e){console.warn('Local research dance unavailable',e.message)}
 tameSkirtSprings();
 console.info('[boot] ready');if(host.value){host.value.dataset.motionBank=localDance?String(localDance.bank?.clips?.length??0):'unavailable';host.value.dataset.danceLibrary=danceLibraryFrames?String(danceLibraryFrames.length):'none'}if(disposed)return;loading.value=false;emit('ready');raf=requestAnimationFrame(tick);
 }catch(e){loading.value=false;error.value=e.message;console.error('VRM',e)}})
function tameSkirtSprings(){
 const manager=vrm?.springBoneManager
 if(!manager?.joints)return 0
 let count=0
 for(const joint of manager.joints){
  const name=joint.bone?.name||''
  if(!/skirt|coat/i.test(name))continue
  const settings=joint.settings
  if(!settings)continue
  // Stiffer, more damped, less gravity so the skirt follows the hips instead of flying with the legs.
  settings.stiffness=Math.min(12,(settings.stiffness||1)*4)
  settings.dragForce=Math.min(1,(settings.dragForce||.4)*2.2)
  settings.gravityPower=(settings.gravityPower||0)*.25
  settings.hitRadius=Math.min(.08,(settings.hitRadius||.02)*1.5)
  count++
 }
 if(count)console.info('[skirt] tamed',count,'spring joints')
 return count
}
function clampBpm(value){const wrapped=value>180?value/2:value<60?value*2:value;return Math.max(60,Math.min(180,wrapped))}
function applyGroove(dt){
 if(!grooveEngine||!vrm)return false;
 const signal=props.audio?.signal
 const onsetFrame=signal?.lastOnsetFrame,newOnset=onsetFrame!==undefined&&onsetFrame!==lastOnsetFrameRef
 if(newOnset)lastOnsetFrameRef=onsetFrame
 const rawBpm=signal?.tempo?.bpm
 // Tempo estimates jitter heavily; keep a slow EMA inside a musical range so the beat clock stays steady.
 const targetBpm=Number.isFinite(rawBpm)?clampBpm(rawBpm):grooveBpm
 grooveBpm=grooveBpm+(targetBpm-grooveBpm)*Math.min(1,dt*1.5)
 const bpm=grooveBpm
 grooveClock+=dt*bpm/60
 if(grooveClock>1e6)grooveClock=grooveClock%1000
 const pose=grooveEngine.step({dt,active:Boolean(signal)&&signal.state!=='silent',energy:signal?.energy??.15,beat:grooveClock,bpm,onset:newOnset,accent:signal?.onsetStrength??.5,bands:signal?.bands??null})
 if(host.value)Object.assign(host.value.dataset,{grooveActive:String(Boolean(signal)&&signal.state!=='silent'),grooveEnergy:Number(signal?.energy??0).toFixed(3),grooveBeat:Number(grooveClock).toFixed(3),grooveBpm:Number(bpm).toFixed(1),grooveRawBpm:Number(rawBpm??0).toFixed(1),grooveState:signal?.state||'none',grooveWeight:Number(pose.weight).toFixed(3)})
 vrm.humanoid.resetNormalizedPose();
 const sign=vrm.meta.metaVersion==='0'?-1:1;
 for(const [name,angles] of Object.entries(pose.rotations)){const node=vrm.humanoid.getNormalizedBoneNode(name);if(node){const [x,y,z]=angles;node.quaternion.setFromEuler(new THREE.Euler(x*sign,y,z*sign,'XYZ'))}}
 const hipsNode=vrm.humanoid.getNormalizedBoneNode('hips');hipsNode.position.copy(hipsRest).add(new THREE.Vector3(pose.hips[0]*sign,pose.hips[1],pose.hips[2]*sign));
 if(pose.feet)for(const side of ['left','right']){const foot=vrm.humanoid.getNormalizedBoneNode(side+'Foot');const off=pose.feet[side];if(foot&&off){foot.position.x+=off[0]*sign;foot.position.y+=off[1];foot.position.z+=off[2]*sign}}
 return true
}
function setupDanceRetarget(){
 if(!vrm||danceRetarget)return;
 const names=['hips','spine','chest','upperChest','neck','head','leftShoulder','leftUpperArm','leftLowerArm','leftHand','rightShoulder','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];
 const MAP=[['spine',0,3],['chest',3,6],['upperChest',6,9],['neck',9,12],['head',12,15],
  ['leftShoulder',13,16],['leftUpperArm',16,18],['leftLowerArm',18,20],['leftHand',20,22],
  ['rightShoulder',14,17],['rightUpperArm',17,19],['rightLowerArm',19,21],['rightHand',21,23],
  ['leftUpperLeg',1,4],['leftLowerLeg',4,7],['leftFoot',7,10],
  ['rightUpperLeg',2,5],['rightLowerLeg',5,8],['rightFoot',8,11]];
 const childBone={spine:'chest',chest:'upperChest',upperChest:'neck',neck:'head',head:null,leftShoulder:'leftUpperArm',leftUpperArm:'leftLowerArm',leftLowerArm:'leftHand',leftHand:null,rightShoulder:'rightUpperArm',rightUpperArm:'rightLowerArm',rightLowerArm:'rightHand',rightHand:null,leftUpperLeg:'leftLowerLeg',leftLowerLeg:'leftFoot',leftFoot:null,rightUpperLeg:'rightLowerLeg',rightLowerLeg:'rightFoot',rightFoot:null};
 const parentBone={spine:'hips',chest:'spine',upperChest:'chest',neck:'upperChest',head:'neck',leftShoulder:'upperChest',leftUpperArm:'leftShoulder',leftLowerArm:'leftUpperArm',leftHand:'leftLowerArm',rightShoulder:'upperChest',rightUpperArm:'rightShoulder',rightLowerArm:'rightUpperArm',rightHand:'rightLowerArm',leftUpperLeg:'hips',leftLowerLeg:'leftUpperLeg',leftFoot:'leftLowerLeg',rightUpperLeg:'hips',rightLowerLeg:'rightUpperLeg',rightFoot:'rightLowerLeg'};
 const order=['spine','chest','upperChest','neck','head','leftShoulder','leftUpperArm','leftLowerArm','leftHand','rightShoulder','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];
 const node=n=>vrm.humanoid.getNormalizedBoneNode(n);
 const rootRot=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
 vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
 const restWorld={};for(const name of names)restWorld[name]=node(name).getWorldPosition(new THREE.Vector3());
 const restDir={},restDirLocal={};
 for(const [bone,,child] of MAP){if(child==null)continue;restDir[bone]=restWorld[childBone[bone]].clone().sub(restWorld[bone]).normalize();restDirLocal[bone]=restDir[bone].clone().applyQuaternion(rootRot.clone().invert())}
 const restDirHead=restWorld.head.clone().sub(restWorld.neck).normalize();
 restDirLocal.head=restDirHead.clone().applyQuaternion(rootRot.clone().invert());
 danceRetarget={MAP,childBone,parentBone,order,node,rootRot,restDirLocal,hipsRest:node('hips').getWorldPosition(new THREE.Vector3()),worldQuat:{}};
}
function applyDanceJoints(joints,frames){
 // joints: Float32Array frames*24*3, 60fps segments
 if(!danceRetarget||frames<1)return;
 const total=danceStreamQueue.reduce((sum,seg)=>sum+seg.frames,0);
 danceStreamQueue.push({joints:new Float32Array(joints),frames,fps:60});
 while(total>900&&danceStreamQueue.length>2)danceStreamQueue.shift();
 danceStreamSilentFor=0;
}
function stepDanceStream(dt){
 if(!danceRetarget)return false;
 if(danceStreamWeight<=0.01&&!danceStreamQueue.length)return false;
 // advance playhead through queued segments (60fps source, ~30fps render)
 let budget=dt*60,segments=danceStreamQueue;
 danceStreamPlayhead+=budget;
 while(segments.length&&danceStreamPlayhead>=segments[0].frames){danceStreamPlayhead-=segments[0].frames;segments.shift()}
 danceStreamWeight=danceStreamQueue.length?Math.min(1,danceStreamWeight+dt/.3):Math.max(0,danceStreamWeight-dt/.5);
 if(!segments.length){danceStreamSilentFor+=dt;return danceStreamWeight>0.01}
 const seg=segments[0],position=Math.max(0,Math.min(seg.frames-1.001,danceStreamPlayhead)),i=Math.floor(position),j=Math.min(seg.frames-1,i+1),t=position-i;
 const jt=(frame,joint,axis)=>seg.joints[frame*72+joint*3+axis];
 const point=(joint,frame,frac)=>new THREE.Vector3(jt(frame,joint,0)*(1-frac)+jt(frame+1,joint,0)*frac,jt(frame,joint,1)*(1-frac)+jt(frame+1,joint,1)*frac,jt(frame,joint,2)*(1-frac)+jt(frame+1,joint,2)*frac);
 const {MAP,parentBone,order,node,rootRot,restDirLocal,hipsRest,worldQuat}=danceRetarget;
 vrm.humanoid.resetNormalizedPose();
 const pelvis=point(0,i,t);
 node('hips').position.copy(hipsRest).add(new THREE.Vector3(pelvis.x,pelvis.y,pelvis.z));
 worldQuat.hips=rootRot.clone();
 for(const bone of order){
  const entry=MAP.find(m=>m[0]===bone);if(!entry)continue;
  const [,parentJoint,childJoint]=entry;
  const p=point(parentJoint,i,t),c=childJoint==null?point(parentJoint,i,t):point(childJoint,i,t);
  const target=c.clone().sub(p).normalize();
  if(target.lengthSq()<1e-6)target.set(0,-1,0);
  const parentQ=parentBone[bone]?worldQuat[parentBone[bone]]:worldQuat.hips;
  const dir=restDirLocal[bone]||restDirLocal.head;
  const look=new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0),target,new THREE.Vector3(0,1,0));
  const R=new THREE.Quaternion().setFromRotationMatrix(look);
  const align=new THREE.Quaternion().setFromUnitVectors(dir,new THREE.Vector3(0,0,-1));
  const worldRot=R.clone().multiply(align);
  node(bone).quaternion.copy(parentQ.clone().invert().multiply(worldRot));
  worldQuat[bone]=worldRot;
 }
 // Crossfade across segment boundaries so new segments blend in instead of snapping.
 if(danceStreamTransition<1){
  danceStreamTransition=Math.min(1,danceStreamTransition+dt/.22);
  const blend=danceStreamTransition*danceStreamTransition*(3-2*danceStreamTransition);
  for(const bone of ['hips','spine','chest','upperChest','neck','head','leftShoulder','leftUpperArm','leftLowerArm','leftHand','rightShoulder','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot']){
   const previous=danceStreamPrevPose?.[bone];if(!previous)continue;
   node(bone).quaternion.copy(new THREE.Quaternion().fromArray(previous).slerp(node(bone).quaternion.clone(),blend));
  }
 }
 danceStreamPrevPose={};
 for(const bone of ['hips','spine','chest','upperChest','neck','head','leftShoulder','leftUpperArm','leftLowerArm','leftHand','rightShoulder','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'])danceStreamPrevPose[bone]=node(bone).quaternion.toArray();
 return true;
}
defineExpose({async configureRootTrajectory(options={}){
 if(props.pet||!vrm||!referenceText||diagnosingLimiter)throw Error('根轨迹实验只在就绪的研究页可用');
 diagnosingLimiter=true;const saved=capturePoseRecord(vrm);
 try{vrm.humanoid.resetNormalizedPose();vrm.humanoid.getNormalizedBoneNode('hips').position.copy(hipsRest);vrm.scene.updateMatrixWorld(true);const candidate=await prepareLocalDance(vrm,referenceText,()=>disposed,{...options,collectRootDiagnostics:true});if(!candidate)throw Error('Root compilation cancelled');localDance=candidate;return {diagnostics:candidate.bank.rootDiagnostics,clips:candidate.bank.clips.map(({id,start,end,anchors})=>({id,start,end,anchors}))}}
 finally{applyPoseRecord(vrm,saved);diagnosingLimiter=false;last=performance.now();if(!disposed)renderer.render(scene,camera)}
 },async configureFullReplay(options={}){if(props.pet||!vrm||!referenceText||diagnosingLimiter)throw Error('完整回放只在就绪的研究页可用');diagnosingLimiter=true;const saved=capturePoseRecord(vrm);
  try{vrm.humanoid.resetNormalizedPose();vrm.humanoid.getNormalizedBoneNode('hips').position.copy(hipsRest);vrm.scene.updateMatrixWorld(true);const candidate=await prepareLocalDance(vrm,referenceText,()=>disposed,{...options,full:true,collectRootDiagnostics:true});if(!candidate)throw Error('Full replay compilation cancelled');localDance=candidate;return {diagnostics:candidate.bank.rootDiagnostics,clips:candidate.bank.clips.map(({id,start,end})=>({id,start,end}))}}
  finally{applyPoseRecord(vrm,saved);diagnosingLimiter=false;last=performance.now();if(!disposed)renderer.render(scene,camera)}
},async configurePlannedPhrases(options={}){
  if(props.pet||!vrm||!referenceText||diagnosingLimiter)throw Error('音乐规划执行只在就绪的研究页可用');
  if(!options.music?.duration)throw Error('音乐规划执行需要音乐描述');
  diagnosingLimiter=true;const saved=capturePoseRecord(vrm);
  try{
    vrm.humanoid.resetNormalizedPose();vrm.humanoid.getNormalizedBoneNode('hips').position.copy(hipsRest);vrm.scene.updateMatrixWorld(true);
    const compiled=await prepareLocalDance(vrm,referenceText,()=>disposed,{...options,full:true});
    if(!compiled)throw Error('Planned compilation cancelled');
    const frames=compiled.bank.frames;if(!frames?.length)throw Error('Compiled frames unavailable');
    const bvh=parseBVH(referenceText);
    const material=buildSourceMotionMaterial(bvh,{sourceId:'local-bvh-research',metersPerUnit:.01,provenance:{license:'CC BY-NC 4.0 - local research only',unitAssumption:'centimetres declared explicitly'}});
    const structure=annotateDanceStructure(material,{fps:1/bvh.frameTime});
    const plan=planDancePhrases({structure,music:options.music});
    plannedMaterial=material;plannedStructure=structure;
    localDance=createPlannedPhrasePlayer(frames,plan,{fps:15});
    return {planSummary:plan.summary,segments:structure.segments.map(({kind,startTime,endTime})=>({kind,startTime,endTime})),phrases:plan.phrases.map(({startTime,endTime,sourceIndex,timeScale,musicMode,reason})=>({startTime,endTime,sourceIndex,timeScale,musicMode,reason}))};
  }finally{applyPoseRecord(vrm,saved);diagnosingLimiter=false;last=performance.now();if(!disposed)renderer.render(scene,camera)}
  },extendPlannedPlan(options={}){
  if(!plannedStructure||!localDance?.setPlan)throw Error('先运行一次音乐规划执行，再扩展计划');
  if(!options.music?.duration)throw Error('扩展计划需要音乐描述');
  const plan=planDancePhrases({structure:plannedStructure,music:options.music});
  const from=localPose?.plan?.musicTime??0;
  localDance.setPlan(plan,{startTime:from});
  return {planSummary:plan.summary,from};
  },configureDanceExecution(options={}){if(!localDance||diagnosingLimiter)throw Error('本地动作尚未就绪或正在评估');localDance=createLocalDancePlayer(localDance.bank,options)},async assessLimiterStages(options={}){if(!vrm||!localDance||diagnosingLimiter)throw Error('本地动作尚未就绪或正在评估');diagnosingLimiter=true;try{return await assessDailyLimiterStages(vrm,localDance.bank,{...options,hipsRest:hipsRest.toArray()})}finally{diagnosingLimiter=false;last=performance.now();if(!disposed)renderer.render(scene,camera)}}})
onBeforeUnmount(()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();removeDanceStream?.();removeSpeech?.();removeMusicAudio?.();musicAudio?.pause();audio?.pause();audioSource?.disconnect();audioContext?.close();if(scene)VRMUtils.deepDispose(scene);renderer?.dispose();renderer?.domElement.remove()})
</script>
<template><div ref="host" class="character" @click="!pet&&emit('touch')" role="img" aria-label="Jessair 蓝发少女 VRM 桌面伙伴"><span v-if="loading" class="character-loading">伙伴正在来这里…</span><span v-if="error" class="character-error">{{error}}</span></div></template>
