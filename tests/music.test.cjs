const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {parseLrc,PlaybackDecoder,normalizePlayback,selectSong,matchSong}=require('../electron/music-domain.cjs');
const {NeteaseMusic}=require('../electron/music.cjs');
const BASE={bundleIdentifier:'com.netease.163music',playing:true,title:'测试曲',artist:'测试歌手',album:'测试专辑',duration:180,elapsedTime:10};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('播放增量合并、暂停及切换其他播放器会清空网易云状态',()=>{
 const decoder=new PlaybackDecoder();
 let state=decoder.decode(JSON.stringify({type:'data',diff:false,payload:BASE}),10000);assert.equal(state.status,'playing');assert.equal(state.position,10);
 state=decoder.decode(JSON.stringify({type:'data',diff:true,payload:{playing:false,elapsedTime:20}}),12000);assert.equal(state.status,'paused');assert.equal(state.title,'测试曲');assert.equal(state.rate,0);
 assert.equal(decoder.decode(JSON.stringify({type:'data',diff:true,payload:{bundleIdentifier:'com.example.other'}})),null);
 assert.equal(decoder.decode(JSON.stringify({type:'data',diff:false,payload:{}})),null);
});
test('LRC支持多时间标签、毫秒、去重与乱序',()=>{
 assert.deepEqual(parseLrc('[offset:500]\n[00:02]提前半秒'),[{time:1.5,text:'提前半秒'}]);
 assert.deepEqual(parseLrc('[ar:fixture]\n[00:03.250]后句\n[00:01.50][00:02.00]前句\n[00:01.50]前句\n[99:99]非法'),[{time:1.5,text:'前句'},{time:2,text:'前句'},{time:3.25,text:'后句'}]);
});
test('歌词搜索严格校验标题歌手时长，歧义不自动选择',()=>{
 const track=normalizePlayback(BASE,10000),song={id:42,name:'测试曲',artists:[{name:'测试歌手'}],duration:180000};
 assert.equal(selectSong([song],track),'42');
 assert.equal(selectSong([{...song,artists:[{name:'其他歌手'}]}],track),null);
 assert.equal(selectSong([{...song,duration:240000}],track),null);
 assert.equal(selectSong([song,{...song,id:43}],track),null);
});
test('十分十二寸的同名再版按当前专辑消歧，不随搜索排名变化',()=>{
 const track={title:'十分十二寸',artist:'林子祥',album:'十分十二寸',duration:586.698625};
 const original={id:117220,name:'十分十二寸',duration:586640,artists:[{name:'林子祥'}],album:{name:'十分十二寸'}};
 const reissue={...original,id:5255693,album:{name:'乐坛班霸'}};
 assert.equal(selectSong([reissue,original],track),'117220');
 assert.equal(selectSong([original,reissue],track),'117220');
 assert.deepEqual(matchSong([original,reissue],{...track,album:''}),{id:null,reason:'ambiguous'});
 assert.equal(selectSong([original,{...original,id:7}],track),null);
 assert.equal(selectSong([{...original,artists:[{name:'其他歌手'}]}],track),null);
});
test('现代搜索响应al/ar/dt字段同样能用专辑消歧',()=>{
 const track={title:'测试曲',artist:'测试歌手',album:'原专辑',duration:180};
 const songs=[{id:1,name:'测试曲',dt:180000,ar:[{name:'测试歌手'}],al:{name:'合集'}},{id:2,name:'测试曲',dt:180000,ar:[{name:'测试歌手'}],al:{name:'原专辑'}}];
 assert.equal(selectSong(songs,track),'2');
});
test('暂缺歌词不作为永久空缓存，重新开启可恢复',async()=>{
 let requests=0;const music=new NeteaseMusic({nativeRoot:'/unused',fetchFn:async()=>({ok:true,json:async()=>++requests===1?{code:200,lrc:{lyric:''}}:{code:200,lrc:{lyric:'[00:01]原创测试句'}}})});music.enabled=true;
 music.accept(normalizePlayback({...BASE,contentItemIdentifier:'42'},10000));await tick();await tick();
 assert.equal(music.snapshot().lyricState,'unavailable');
 music.setLyrics(false);music.setLyrics(true);await tick();await tick();
 assert.equal(music.snapshot().lyricState,'synced');assert.equal(requests,2);music.stop();
});
test('歌词切歌竞态与UUID来源标识不会串入上一首',async()=>{
 let releaseFirst;const first=new Promise(resolve=>releaseFirst=resolve);
 const music=new NeteaseMusic({nativeRoot:'/unused',fetchFn:async url=>{
  const id=new URL(url).searchParams.get('id');if(id==='1')await first;
  return {ok:true,json:async()=>({code:200,lrc:{lyric:`[00:01]曲目${id}`}})};
 }});music.enabled=true;
 music.accept(normalizePlayback({...BASE,contentItemIdentifier:'1'},10000));
 music.accept(normalizePlayback({...BASE,title:'另一首',contentItemIdentifier:'2'},10000));
 await tick();await tick();releaseFirst();await tick();await tick();
 assert.equal(music.snapshot().title,'另一首');assert.equal(music.snapshot().lines[0].text,'曲目2');music.stop();
});
test('搜索得到歌曲ID后，进度和暂停更新不会重复查询歌词',async()=>{
 let requests=0;const music=new NeteaseMusic({nativeRoot:'/unused',fetchFn:async url=>{requests++;return {ok:true,json:async()=>url.includes('/search/')?{code:200,result:{songs:[{id:42,name:'测试曲',artists:[{name:'测试歌手'}],duration:180000}]}}:{code:200,lrc:{lyric:'[00:01]测试文字'}}};}});music.enabled=true;
 const track=normalizePlayback({...BASE,contentItemIdentifier:'C203225C-31C3-4D08-88EC-C4EDA5C8F23F'},10000);
 music.accept(track);await tick();await tick();assert.equal(music.snapshot().songId,'42');
 music.accept({...track,position:15});music.accept({...track,status:'paused',rate:0});await tick();assert.equal(requests,2);music.stop();
});
test('控制命令即时确认来源，其他播放器不会收到命令',async()=>{
 const calls=[];const music=new NeteaseMusic({nativeRoot:'/unused',execute:async(_bin,args)=>{calls.push(args);return {stdout:JSON.stringify({...BASE,bundleIdentifier:'com.example.other'})};}});
 await assert.rejects(music.command('next'),/不是网易云/);assert.equal(calls.length,1);
});
test('界面时钟冻结暂停、支持回退跳转，舞动参数受强度控制',async()=>{
 const {playbackPosition,lyricAt,dancePose}=await import('../src/music-view.js');
 assert.equal(playbackPosition({status:'playing',position:10,observedAt:1000,rate:1,duration:100},3000),12);
 assert.equal(playbackPosition({status:'paused',position:10,observedAt:1000,rate:0,duration:100},3000),10);
 const lines=[{time:1,text:'甲'},{time:10,text:'乙'}];assert.equal(lyricAt(lines,11).current,'乙');assert.equal(lyricAt(lines,2).current,'甲');assert.equal(lyricAt(lines,0).current,'');
 assert.deepEqual(dancePose(1,0),{head:0,body:0,nod:0,leftArm:0,rightArm:0,bounce:0});assert.notDeepEqual(dancePose(0,1),dancePose(.3,1));
});
test('原生音乐工作线程分析真实PCM块，而非只读播放器进度',async()=>{
 const {Worker}=require('node:worker_threads');const path=require('node:path');
 const worker=new Worker(path.join(__dirname,'../electron/music-audio-worker.mjs'),{workerData:{mode:'netease'}});
 try{
  const signal=new Promise((resolve,reject)=>{worker.on('message',m=>{if(m.type==='signal')resolve(m.signal);});worker.once('error',reject);});
  const samples=Float32Array.from({length:4800},(_,i)=>Math.sin(i/48000*2*Math.PI*80)*.5);
  worker.postMessage({type:'pcm',buffer:samples.buffer},[samples.buffer]);
  const result=await Promise.race([signal,new Promise((_,reject)=>setTimeout(()=>reject(Error('Audio worker timeout')),3000).unref())]);
  assert.equal(result.schema,'music-signal/v1');assert(result.energy>0);assert(result.sampleFrame>0);
 }finally{await worker.terminate();}
});
