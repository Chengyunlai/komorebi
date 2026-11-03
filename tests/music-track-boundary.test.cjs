const {test}=require('node:test');const assert=require('node:assert/strict');
const {createMusicTrackBoundary}=require('../electron/music-track-boundary.cjs');
const {MusicAudio}=require('../electron/music-audio.cjs');
test('playing-to-playing song changes reset once; lyrics IDs and progress do not',()=>{
 const changed=createMusicTrackBoundary(),a={source:'netease',title:'A',artist:'artist',album:'album',status:'playing'};
 assert.equal(changed(a),false);
 assert.equal(changed({...a,songId:42,position:2}),false);
 assert.equal(changed({...a,title:'B'}),true);
 assert.equal(changed({...a,title:'B',lyricState:'synced'}),false);
});
test('track reset invalidates music history without restarting the native capture',()=>{
 const audio=new MusicAudio({nativeRoot:'/unused'}),messages=[];
 audio.worker={postMessage:value=>messages.push(value)};audio.state={mode:'netease',signal:{streamId:'old'}};
 audio.pcmChunks=[{data:new Float32Array([1])}];const child={};audio.child=child;
 audio.resetTrack();assert.equal(audio.child,child);assert.deepEqual(audio.pcmChunks,[]);
 assert.equal(audio.state.signal,null);assert.equal(audio.analysisEpoch,1);
 assert.deepEqual(messages,[{type:'reset-track',epoch:1}]);
});
test('worker starts a fresh stream and tags signals after track reset',async()=>{
 const {Worker}=require('node:worker_threads');const path=require('node:path');
 const worker=new Worker(path.resolve(__dirname,'../electron/music-audio-worker.mjs'),{workerData:{mode:'system',session:7}});
 const signals=[];worker.on('message',message=>{if(message.type==='signal')signals.push(message)});
 const push=()=>new Promise(resolve=>{const listener=message=>{if(message.type==='ack'){worker.off('message',listener);resolve()}};worker.on('message',listener);worker.postMessage({type:'pcm',buffer:new Float32Array(4800).buffer})});
 try{await push();assert.equal(signals.at(-1).epoch,0);const old=signals.at(-1).signal.streamId;
 worker.postMessage({type:'reset-track',epoch:1});await push();const fresh=signals.at(-1);
 assert.equal(fresh.epoch,1);assert.notEqual(fresh.signal.streamId,old);assert.equal(fresh.signal.lastOnsetFrame,null);
 }finally{await worker.terminate()}
});
