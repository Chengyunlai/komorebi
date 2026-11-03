import {MusicAnalyzer} from '../../../electron/vendor/music-signal/analyzer.mjs'
import {VRMDanceController} from '../../../src/motion/vrm-dance.mjs'
import {BeatStepPlayer} from '../../../src/motion/beat-steps.mjs'
/** Original continuous bed + known drum grid, for testing the actual PCM -> motion chain. */
export function verifyStablePCM(bank,bpm){
 const sampleRate=24000,block=800,analyzer=new MusicAnalyzer({sampleRate,streamId:`stable-${bpm}`}),clock=new VRMDanceController(),player=new BeatStepPlayer(bank),errors=[];let signal,pose,tracking=0;const visited=new Set();
 for(let frame=0;frame<900;frame++){
  const pcm=Float32Array.from({length:block},(_,i)=>{const t=(frame*block+i)/sampleRate,age=t%(60/bpm);return .025*Math.sin(2*Math.PI*220*t)+(age<.16?.65*Math.exp(-age*30)*Math.sin(2*Math.PI*60*age):0)});
  for(const packet of analyzer.push({mono:pcm,startFrame:frame*block}))if(packet.type==='features')signal=packet;
  const now=(frame+1)/30,signalAge=signal?now-signal.sampleFrame/sampleRate:Infinity;
  const p=clock.step({dt:1/30,audioMode:true,signal,signalAge,tempo:bpm}).source;
  pose=player.step({dt:1/30,active:p.primitive!=='rest',beat:p.beat,bpm:p.bpm,clockEpoch:p.clockEpoch,timing:p.timing,energy:signal?.energy});visited.add(pose.clip);
  if(now>12&&p.timing==='tracking'){tracking++;const error=p.beat-now*bpm/60;errors.push(Math.abs(error-Math.round(error))*60/bpm)}
 }
 return {bpm,trackingSamplesAfter12s:tracking,maxClockErrorSeconds:errors.length?Math.max(...errors):null,meanClockErrorSeconds:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,visited:[...visited],switches:pose.switches};
}
