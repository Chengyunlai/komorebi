import {parentPort,workerData} from 'node:worker_threads';
import {MusicAnalyzer} from './vendor/music-signal/analyzer.mjs';
import {demoBlock} from './vendor/music-signal/demo-audio.mjs';
import {createMusicSignalDelivery} from './music-signal-delivery.mjs';
let analyzer,deliver,frame=0,sampleRate=48000,session=0,epoch=0,timer;
function configure(rate){sampleRate=rate;frame=0;analyzer=new MusicAnalyzer({sampleRate,streamId:`${workerData.mode}-${workerData.session??0}-${++session}`});deliver=createMusicSignalDelivery();}
function process(pcm){
 if(!analyzer)return;const events=analyzer.push({mono:pcm,startFrame:frame});frame+=pcm.length;
 const feature=deliver(events);if(feature)parentPort.postMessage({type:'signal',signal:feature,epoch});
}
configure(48000);
function startDemo(){
 if(timer)return;
 const began=performance.now();timer=setInterval(()=>{
  const end=Math.min(24*sampleRate,Math.floor((performance.now()-began)/1000*sampleRate));
  if(end>frame)process(demoBlock(frame,end-frame,sampleRate));
  if(frame>=24*sampleRate){clearInterval(timer);parentPort.postMessage({type:'ended'});}
 },20);
}
parentPort.on('message',message=>{
 if(message.type==='demo-start')startDemo();
 if(message.type==='reset-track'){epoch=message.epoch;configure(sampleRate);}
 if(message.type==='format')configure(message.sampleRate);
 if(message.type==='pcm'){process(new Float32Array(message.buffer));parentPort.postMessage({type:'ack'});}
 if(message.type==='gap')configure(sampleRate);
 if(message.type==='stop'){clearInterval(timer);process.exit(0);}
});
