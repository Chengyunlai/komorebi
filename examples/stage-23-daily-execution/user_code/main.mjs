import {Vector3,Euler} from 'three'
import {createRotationFixture} from '../../stage-15-rotation-retarget/core/rotation-body.mjs'
import {MusicAnalyzer} from '../../../electron/vendor/music-signal/analyzer.mjs'
import {demoBlock} from '../../../electron/vendor/music-signal/demo-audio.mjs'
import {VRMDanceController} from '../../../src/motion/vrm-dance.mjs'
import {prepareLocalDance,createLocalDanceExecutor} from '../../../src/motion/local-dance.mjs'
const {vrm,bvh}=createRotationFixture(),count=360;
function joint(i){const j=bvh.joints[i],children=bvh.joints.flatMap((n,k)=>n.parent===i?[k]:[]);return `${j.parent<0?'ROOT':'JOINT'} ${j.name} { OFFSET ${j.offset.join(' ')} CHANNELS ${j.channels.length} ${j.channels.join(' ')} ${children.map(joint).join(' ')} }`}
const rows=Array.from({length:count},(_,i)=>Array.from(bvh.values.slice(i%bvh.frameCount*bvh.channelCount,(i%bvh.frameCount+1)*bvh.channelCount)).join(' '));
const text=`HIERARCHY ${joint(0)} MOTION Frames: ${count} Frame Time: ${bvh.frameTime} ${rows.join(' ')}`;
const hips=vrm.humanoid.getNormalizedBoneNode('hips'),hipsRest=hips.position.clone(),player=await prepareLocalDance(vrm,text),executor=createLocalDanceExecutor(vrm),analyzer=new MusicAnalyzer({sampleRate:24000,streamId:'original-integration'}),clock=new VRMDanceController();
let signal,features=0,maxError=0,activeSamples=0,last;const quiet=[],bpms=new Set();
for(let i=0;i<810;i++){
 for(const packet of analyzer.push({mono:demoBlock(i*800,800,24000),startFrame:i*800}))if(packet.type==='features'){signal=packet;features++}
 const now=(i+1)/30,p=clock.step({dt:1/30,audioMode:true,enabled:true,signal,signalAge:now-signal.sampleFrame/24000,tempo:100});
 const pose=player.step({dt:1/30,active:p.source.mode==='audio'&&p.source.primitive!=='rest',beat:p.source.beat,bpm:p.source.bpm,clockEpoch:p.source.clockEpoch,timing:p.source.timing,energy:signal.energy});
 vrm.humanoid.resetNormalizedPose();for(const [name,angles] of Object.entries(p.rotations)){const bone=vrm.humanoid.getNormalizedBoneNode(name);if(bone)bone.quaternion.setFromEuler(new Euler(...angles))}hips.position.copy(hipsRest).add(new Vector3(...p.hips));vrm.scene.updateMatrixWorld(true);last=executor.apply(pose,hipsRest);vrm.update(0);maxError=Math.max(maxError,last.desiredError||0);if(pose.weight>0)activeSamples++;bpms.add(Math.round(p.source.bpm));if((now>15&&now<16)||(now>25&&now<27))quiet.push({time:now,weight:pose.weight,mode:last.mode});
}
console.log(JSON.stringify({schema:'daily-execution-example/v1',fixture:'original repeated synthetic source; fallback clip library is expected without reliable landing events',bank:{execution:player.bank.execution,worldAlignment:player.bank.worldAlignment,rootPolicy:player.bank.rootPolicy,clips:player.bank.clips.length},features,activeSamples,observedBpm:[...bpms],maxDesiredError:maxError,quietWindows:quiet,last,legacyContactApplied:false,scope:'actual PCM analyzer, controller, bank and executor on synthetic body; no visual/contact/listening sync assertion'},null,2));
