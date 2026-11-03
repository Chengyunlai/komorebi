const {EventEmitter}=require('node:events');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs');
const path=require('node:path');
const {NETEASE_BUNDLE,parseLrc,normalizePlayback,trackIdentity,matchSong,PlaybackDecoder}=require('./music-domain.cjs');
const exec=promisify(execFile);
const HEADERS={'Referer':'https://music.163.com/','User-Agent':'Mozilla/5.0'};
function empty(status='idle',message='在网易云音乐播放一首歌，我就能跟着听。'){
 return {source:'netease',status,title:'',artist:'',album:'',songId:null,duration:0,position:0,rate:0,observedAt:Date.now(),lines:[],lyricState:'idle',message,preview:false};
}
class NeteaseMusic extends EventEmitter {
 constructor({nativeRoot,fetchFn=fetch,spawnProcess=spawn,execute=exec,lyrics=true}={}){
  super();this.nativeRoot=nativeRoot;this.fetchFn=fetchFn;this.spawnProcess=spawnProcess;this.execute=execute;this.lyrics=lyrics;this.state=empty();this.child=null;this.decoder=new PlaybackDecoder();this.generation=0;this.controller=null;this.cache=new Map();this.enabled=false;this.previewTimer=null;this.trackKey='';
 }
 snapshot(){return {...this.state,lines:this.state.lines.map(line=>({...line}))};}
 publish(patch){this.state={...this.state,...patch};this.emit('change',this.snapshot());}
 args(command,...options){return [path.join(this.nativeRoot,'mediaremote-adapter.pl'),path.join(this.nativeRoot,'MediaRemoteAdapter.framework'),command,...options];}
 async request(pathname,query,signal){
  const url=new URL(pathname,'https://music.163.com');for(const [key,value] of Object.entries(query))url.searchParams.set(key,String(value));
  const response=await this.fetchFn(url.href,{headers:HEADERS,signal});
  if(!response.ok)throw new Error('歌词服务暂不可用。');
  const body=await response.json();if(body.code!==200)throw new Error('歌词服务暂不可用。');return body;
 }
 async loadLyrics(track,generation){
  this.controller?.abort();const controller=new AbortController();this.controller=controller;
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
   let id=track.songId;
   if(!id){
    const data=await this.request('/api/search/get/web',{s:`${track.title} ${track.artist}`,type:1,limit:30,offset:0},controller.signal);
    const match=matchSong(data.result?.songs,track);id=match.id;
    if(!id){if(generation===this.generation)this.publish({lyricState:match.reason,message:match.reason==='ambiguous'?'找到多个版本，暂时无法确认当前专辑。':'暂未匹配到当前歌曲，试试重新连接。'});return;}
   }
   let value=this.cache.get(id);
   if(!value){const data=await this.request('/api/song/lyric',{id,lv:-1,kv:-1,tv:-1},controller.signal);const lines=parseLrc(data.lrc?.lyric);value={lines,lyricState:lines.length?'synced':data.nolyric?'instrumental':'unavailable'};if(lines.length){this.cache.set(id,value);if(this.cache.size>20)this.cache.delete(this.cache.keys().next().value);}}
   if(generation===this.generation&&this.enabled&&!this.state.preview)this.publish({...value,songId:id,message:value.lines.length?'歌词已同步':value.lyricState==='instrumental'?'网易云将这首歌标记为纯音乐。':'已找到歌曲，但接口暂未返回可同步歌词，可重新连接重试。'});
  }catch{
   if(generation===this.generation&&this.enabled&&!this.state.preview)this.publish({lines:[],lyricState:'unavailable',message:'歌词暂不可用，人物仍会随播放律动。'});
  }finally{clearTimeout(timeout);if(this.controller===controller)this.controller=null;}
 }
 accept(track){
  if(!this.enabled)return;
  if(this.state.preview){if(track?.status!=='playing')return;this.stopPreview(false);}
  if(!track){this.trackKey='';this.generation++;this.controller?.abort();this.publish(empty());return;}
  const key=trackIdentity(track);const changed=key!==this.trackKey;
  if(changed){this.trackKey=key;this.generation++;this.publish({...track,preview:false,lines:[],lyricState:this.lyrics?'loading':'off',message:this.lyrics?'正在同步歌词…':'歌词已关闭。'});if(this.lyrics)this.loadLyrics(track,this.generation);}
  else this.publish({...track,songId:this.state.songId||track.songId});
 }
 start(){
  this.stop();this.enabled=true;this.decoder=new PlaybackDecoder();
  if(process.platform!=='darwin'||!fs.existsSync(path.join(this.nativeRoot,'MediaRemoteAdapter.framework'))){this.publish(empty('unavailable','音乐识别组件尚未就绪。'));return;}
  this.publish(empty('waiting'));
  const child=this.spawnProcess('/usr/bin/perl',this.args('stream','--no-artwork','--debounce=80'),{stdio:['ignore','pipe','ignore']});this.child=child;let buffer='',received=false;
  const firstLine=setTimeout(async()=>{
   if(this.child!==child||received)return;
   try{const {stdout}=await this.execute('/usr/bin/perl',this.args('get','--no-artwork','--now'),{timeout:6000,maxBuffer:1024*1024});if(this.child===child)this.accept(normalizePlayback(JSON.parse(stdout)));}catch{if(this.child===child)this.publish(empty('unavailable','没有读取到播放状态，可在音乐入口重新连接。'));}
  },8000);
  child.stdout.on('data',data=>{
   if(this.child!==child)return;buffer+=data.toString();if(buffer.length>1024*1024){child.kill();return;}
   let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;try{const track=this.decoder.decode(line);received=true;clearTimeout(firstLine);this.accept(track);}catch{}}
  });
  const finish=()=>{clearTimeout(firstLine);if(this.child===child){this.child=null;this.generation++;this.controller?.abort();if(!this.state.preview)this.publish(empty('unavailable','音乐连接已断开，可重新连接。'));}};
  child.once('error',finish);child.once('close',finish);
 }
 stop(){
  this.enabled=false;this.trackKey='';this.generation++;this.controller?.abort();this.controller=null;clearInterval(this.previewTimer);this.previewTimer=null;
  const child=this.child;this.child=null;if(child)try{child.kill('SIGTERM');}catch{}
  this.publish(empty('disabled','音乐陪伴已关闭。'));
 }
 setLyrics(enabled){this.lyrics=Boolean(enabled);this.generation++;this.controller?.abort();if(!enabled){this.publish({lines:[],lyricState:'off',message:'歌词已关闭。'});return;}if(this.state.title&&!this.state.preview){this.publish({lyricState:'loading'});this.loadLyrics(this.state,this.generation);}}
 async command(action){
  const codes={toggle:2,next:4,previous:5};if(!(action in codes))throw new Error('无效音乐操作。');
  if(this.state.preview)throw new Error('当前是效果预览，没有控制实际播放器。');
  const {stdout}=await this.execute('/usr/bin/perl',this.args('get','--no-artwork'),{timeout:5000,maxBuffer:1024*1024});
  const current=JSON.parse(stdout);if(current?.bundleIdentifier!==NETEASE_BUNDLE)throw new Error('当前播放来源不是网易云音乐，没有发送控制。');
  await this.execute('/usr/bin/perl',this.args('send',String(codes[action])),{timeout:5000,maxBuffer:1024*1024});
 }
 preview(){
  if(this.state.status==='playing'&&!this.state.preview)throw new Error('正在跟随实际音乐，暂停后再体验预览。');
  this.enabled=true;this.generation++;this.controller?.abort();clearInterval(this.previewTimer);
  const began=Date.now();const lines=parseLrc('[00:00]把心事轻轻放下\n[00:04]让晚风经过窗边\n[00:08]这一刻陪你听歌\n[00:12]慢一点也没关系');
  const update=()=>this.publish({source:'netease',status:'playing',title:'音乐陪伴效果预览',artist:'原创示例文字 · 无音频',album:'',duration:16,position:((Date.now()-began)/1000)%16,rate:1,observedAt:Date.now(),lines,lyricState:'synced',message:'效果预览，不是实际播放。',preview:true,songId:null});
  update();this.previewTimer=setInterval(update,1000);
 }
 stopPreview(reset=true){this.trackKey='';clearInterval(this.previewTimer);this.previewTimer=null;if(reset)this.publish(empty());else this.state={...empty()};}
}
module.exports={NeteaseMusic};
