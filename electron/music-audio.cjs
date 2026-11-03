const {EventEmitter}=require('node:events');const {Worker}=require('node:worker_threads');const {spawn}=require('node:child_process');const path=require('node:path');const fs=require('node:fs');
class MusicAudio extends EventEmitter {
 constructor({nativeRoot}){super();this.nativeRoot=nativeRoot;this.worker=null;this.child=null;this.state={mode:'off',status:'off',message:'音频跟拍未开启。',signal:null};this.generation=0;this.analysisEpoch=0;this.pcmChunks=[];this.pcmRate=48000;this.pcmKeepSeconds=16;}
 readyDemo(){if(this.state.mode==='demo')this.worker?.postMessage({type:'demo-start'});}
 snapshot(){return {...this.state};}
 publish(patch){this.state={...this.state,...patch};this.emit('change',this.snapshot());}
 recentPcm(seconds=10){const rate=this.pcmRate,need=Math.floor(seconds*rate);const chunks=[];let total=0;for(let i=this.pcmChunks.length-1;i>=0;i--){const chunk=this.pcmChunks[i];chunks.unshift(chunk);total+=chunk.data.length;if(total>=need)break}if(!chunks.length)return null;const out=new Float32Array(Math.min(total,need));let offset=out.length;for(let i=chunks.length-1;i>=0&&offset>0;i--){const data=chunks[i].data;const take=Math.min(data.length,offset);offset-=take;out.set(data.subarray(data.length-take),offset)}return {pcm:out,sampleRate:rate}}
 recentWav(seconds=10){const recent=this.recentPcm(seconds);if(!recent)return null;const {pcm,sampleRate}=recent;const wav=Buffer.alloc(44+pcm.length*2);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),44+i*2);return wav}
 resetTrack(){
  if(!this.worker||!['netease','system'].includes(this.state.mode))return;
  this.analysisEpoch++;this.pcmChunks=[];
  this.worker.postMessage({type:'reset-track',epoch:this.analysisEpoch});
  this.publish({status:'starting',signal:null,message:'歌曲已切换，重新分析音乐…'});
 }
 stop(){this.analysisEpoch=0;this.pcmChunks=[];this.generation++;clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;const child=this.child;this.child=null;child?.kill('SIGTERM');this.emit('audio',{type:'stop'});this.publish({mode:'off',status:'off',signal:null,message:'音频跟拍未开启。'});}
 async start(mode){
  if(!['demo','netease','system'].includes(mode))throw Error('无效音频模式。');this.stop();const generation=this.generation;
  const worker=new Worker(path.join(__dirname,'music-audio-worker.mjs'),{workerData:{mode,session:generation}});this.worker=worker;let pending=0;
  this.publish({mode,status:'starting',signal:null,message:mode==='demo'?'原创节奏试跳 · 24秒':mode==='system'?'等待系统声音…':'等待网易云音频与系统授权…'});
  worker.on('message',data=>{if(generation!==this.generation)return;if(data.type==='ack')pending=Math.max(0,pending-1);if(data.type==='signal'){if(data.epoch!==this.analysisEpoch)return;clearTimeout(this.timeout);this.publish({status:mode!=='demo'&&data.signal.state==='silent'?'silent':'active',signal:data.signal,message:mode==='demo'?'原创节奏试跳 · 无商业音乐':mode==='system'?(data.signal.state==='silent'?'系统声音静音，请播放任意声音。':'正在分析系统音频 · 仅在本机'):(data.signal.state==='silent'?'收到静音信号，请检查网易云播放与系统授权。':'正在分析网易云音频 · 仅在本机')});}if(data.type==='ended')this.stop();});
  const fail=message=>{if(generation!==this.generation)return;this.stop();this.publish({mode,status:'error',message,signal:null});};
  worker.once('error',()=>fail('音乐分析器暂时未能启动。'));
  if(mode==='demo'){
   const {demoBlock}=await import('./vendor/music-signal/demo-audio.mjs');if(generation!==this.generation)return;
   const rate=24000,pcm=demoBlock(0,rate*24,rate),wav=Buffer.alloc(44+pcm.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)wav.writeInt16LE(Math.round(pcm[i]*32767),44+i*2);
   this.emit('audio',{type:'demo',audio:'data:audio/wav;base64,'+wav.toString('base64')});return;
  }
  const executable=path.join(this.nativeRoot,'komorebi-audio-tap');if(!fs.existsSync(executable)){fail('音频采集组件尚未构建。');return;}
  const child=spawn(executable,mode==='system'?['--system']:[],{stdio:['ignore','pipe','pipe']});this.child=child;let remainder=Buffer.alloc(0),errors='';
  child.stdout.on('data',data=>{
   if(generation!==this.generation)return;const bytes=Buffer.concat([remainder,data]),length=bytes.length-bytes.length%4;remainder=bytes.subarray(length);
   if(!length)return;if(pending>=4){worker.postMessage({type:'gap'});return;}
   const pcm=new Float32Array(length/4);for(let i=0;i<pcm.length;i++)pcm[i]=Math.max(-1,Math.min(1,bytes.readFloatLE(i*4)||0));
   this.pcmChunks.push({time:Date.now(),data:new Float32Array(pcm)});
   const keep=this.pcmKeepSeconds*this.pcmRate;let total=0;
   for(let i=this.pcmChunks.length-1;i>=0;i--){total+=this.pcmChunks[i].data.length;if(total>=keep){this.pcmChunks=this.pcmChunks.slice(i);break}}
   pending++;worker.postMessage({type:'pcm',buffer:pcm.buffer},[pcm.buffer]);
  });
  child.stderr.on('data',data=>{errors+=data.toString();if(errors.length>65536){fail('采集组件返回异常数据。');return;}let end;while((end=errors.indexOf('\n'))>=0){const line=errors.slice(0,end);errors=errors.slice(end+1);try{const value=JSON.parse(line);if(value.type==='format'){this.pcmRate=value.sampleRate||48000;worker.postMessage({type:'format',sampleRate:value.sampleRate})}if(value.type==='gap')worker.postMessage({type:'gap'});if(value.type==='error')fail(value.message);}catch{}}});
  child.once('error',()=>fail(mode==='system'?'系统音频采集未能启动。':'网易云音频采集未能启动。'));child.once('close',()=>fail('音频采集已停止，可重新开启。'));
  this.timeout=setTimeout(()=>{if(generation===this.generation)this.publish({status:'waiting',message:mode==='system'?'尚未收到声音；请播放任意音频，并允许系统音频录制权限。':'尚未收到音频；请播放网易云，并允许系统音频录制权限。'});},8000);
 }
}
module.exports={MusicAudio};
