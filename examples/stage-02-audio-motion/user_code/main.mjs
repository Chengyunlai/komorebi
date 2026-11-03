import {MusicMotionSimulator} from '#motion';
import {MusicAnalyzer} from '#music-analysis';
import {demoBlock} from '#demo-audio';
const rate=48000,analyzer=new MusicAnalyzer({sampleRate:rate,streamId:'original-pcm'}),simulator=new MusicMotionSimulator();
let lastEvent=0;
for(let frame=0;frame<rate*24;frame+=960){
 const events=analyzer.push({mono:demoBlock(frame,960,rate),startFrame:frame});
 const signal=events.filter(x=>x.type==='features').at(-1);if(!signal)continue;
 const pose=simulator.step({dt:.02,signal,signalAge:0});
 if(pose.eventCount!==lastEvent||frame%rate===0){console.log(JSON.stringify({second:frame/rate,energy:signal.energy,bands:signal.bands,primitive:pose.primitive,eventCount:pose.eventCount,strength:pose.strength,leftArm:pose.leftArm,rightArm:pose.rightArm}));lastEvent=pose.eventCount;}
}
