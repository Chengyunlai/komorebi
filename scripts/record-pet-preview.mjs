// Record only the actual pet window through macOS, plus native playback audio.
// Usage: node scripts/record-pet-preview.mjs /absolute/output [song title]
// The running app needs --remote-debugging-port=9223. ffmpeg/ffprobe are required.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn, execFileSync} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const output=path.resolve(process.argv[2]||path.join(root,'docs/evidence/pet-preview'))
const title=process.argv[3]||'Boom Boom Pow',duration=40
const native=(...args)=>execFileSync('/usr/bin/perl',[path.join(root,'native/mediaremote/mediaremote-adapter.pl'),path.join(root,'native/mediaremote/MediaRemoteAdapter.framework'),...args],{encoding:'utf8',timeout:5000})
const targets=await(await fetch('http://127.0.0.1:9223/json/list')).json(),target=targets.find(t=>t.url.endsWith('?view=pet'))
if(!target)throw Error('Start the app with --remote-debugging-port=9223')
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let id=0,tap,recorder,audioFile,audioClosed=false
const pending=new Map(),errors=[],bursts=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}))})
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value}
const snapshot=()=>evaluate(`(async()=>{const m=await window.komorebi.musicSnapshot();return {title:m.title,status:m.status,character:{...document.querySelector('.character').dataset}}})()`)
try{
 const rendererTimeOrigin=await evaluate('performance.timeOrigin/1000')
 const before=await snapshot();if(before.title.toLowerCase()!==title.toLowerCase())throw Error(`Select ${title} in the music player first`)
 await fs.mkdir(output,{recursive:true})
 const windowId=Number(execFileSync('swift',['-e',`import CoreGraphics; import Foundation
 let windows=CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] ?? []
 for w in windows where (w[kCGWindowOwnerName as String] as? String)=="Electron" && (w[kCGWindowName as String] as? String ?? "").contains("木漏日") {
 if let b=w[kCGWindowBounds as String] as? [String:Double], b["Width"]==290 {print(w[kCGWindowNumber as String] as! Int);break}
 }`],{encoding:'utf8'}).trim())
 if(!windowId)throw Error('Pet window not found')
 audioFile=await fs.open(path.join(output,'source.f32le'),'w')
 let audioOrigin,audioBytes=0,sampleRate=48000,stderr='',writeChain=Promise.resolve()
 tap=spawn(path.join(root,'native/audio-tap/komorebi-audio-tap'),['--system'],{stdio:['ignore','pipe','pipe']})
 const audioExit=new Promise(resolve=>tap.once('exit',resolve))
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('No captured audio within 10 seconds')),10000)
  tap.stdout.on('data',bytes=>{if(audioOrigin===undefined){audioOrigin=Date.now()/1000-bytes.length/(sampleRate*4);clearTimeout(timer);resolve()}audioBytes+=bytes.length;writeChain=writeChain.then(()=>audioFile.write(bytes))})
  tap.stderr.on('data',bytes=>{stderr+=bytes.toString();let end;while((end=stderr.indexOf('\n'))>=0){const line=stderr.slice(0,end);stderr=stderr.slice(end+1);try{const m=JSON.parse(line);if(m.type==='format')sampleRate=m.sampleRate;if(m.type==='gap')errors.push(m);if(m.type==='error'){clearTimeout(timer);reject(Error(m.message))}}catch{}}})
  tap.once('error',reject);tap.once('exit',()=>{if(audioOrigin===undefined){clearTimeout(timer);reject(Error('Audio capture exited before receiving PCM'))}})
 })
 if(before.status!=='playing')native('send','0')
 await ready
 const rawVideo=path.join(output,'window.mov')
 recorder=spawn('screencapture',['-v','-V45',`-l${windowId}`,'-x',rawVideo],{stdio:['ignore','ignore','pipe']})
 const recorded=new Promise((resolve,reject)=>{recorder.once('error',reject);recorder.once('exit',code=>code===0?resolve():reject(Error(`Window recorder exited ${code}`)))})
 // A short corner marker calibrates the native video's time zero. It is removed
 // before seeking/recording the song opening and never appears in the export.
 await delay(500)
 const marker=await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>{const el=document.createElement('div');el.id='preview-sync';Object.assign(el.style,{position:'fixed',left:'20px',top:'20px',width:'8px',height:'8px',background:'white',zIndex:'2147483647',pointerEvents:'none'});document.body.append(el);const wall=Date.now()/1000;setTimeout(()=>{el.remove();resolve(wall)},180)}))`)
 native('seek','0');await evaluate("window.komorebi.musicAudioStart('netease').then(()=>true)")
 await evaluate(`(()=>{const stats={running:true,frames:[]};window.__petPreviewStats=stats;let last=performance.now();const tick=now=>{if(!stats.running)return;stats.frames.push({wall:Date.now()/1000,dt:now-last});last=now;requestAnimationFrame(tick)};requestAnimationFrame(tick)})()`)
 console.log('Recording native window and actual playback audio')
 await delay(1500)
 const queryStart=Date.now()/1000,music=JSON.parse(native('get','--no-artwork','--now')),queryEnd=Date.now()/1000
 if(music.bundleIdentifier!=='com.netease.163music'||music.title.toLowerCase()!==title.toLowerCase()||!music.playing||music.elapsedTimeNow>4)throw Error('Could not confirm the song opening')
 const songZero=(queryStart+queryEnd)/2-music.elapsedTimeNow
 while(Date.now()/1000-songZero<duration+1){const d=await evaluate(`({...document.querySelector('.music-fireworks').dataset})`);if(d.fireworkAt)bursts.set(d.fireworkAt,d);await delay(150)}
 await recorded;tap.kill('SIGTERM');await audioExit;await writeChain;await audioFile.close();audioClosed=true
 const stats=await evaluate(`(()=>{const s=window.__petPreviewStats;s.running=false;delete window.__petPreviewStats;return s.frames})()`),after=await snapshot()
 if(after.title.toLowerCase()!==title.toLowerCase())throw Error('Song changed during recording')
 await fs.writeFile(path.join(output,'capture-metadata.json'),JSON.stringify({before,after,music,songZero,audioOrigin,sampleRate,audioBytes,marker,stats,bursts:[...bursts.values()],errors},null,2)+'\n')
 const timing=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','frame=best_effort_timestamp_time','-of','json',rawVideo],{encoding:'utf8',maxBuffer:8*1024*1024})).frames.map(f=>Number(f.best_effort_timestamp_time))
 const markerPixels=execFileSync('ffmpeg',['-v','error','-i',rawVideo,'-t','3','-vf','crop=8:8:20:20,format=gray','-fps_mode','passthrough','-f','rawvideo','-'],{maxBuffer:1024*1024})
 let markerIndex=-1
 for(let i=0;i<markerPixels.length/64;i++){let sum=0;for(let j=0;j<64;j++)sum+=markerPixels[i*64+j];if(sum/64>200){markerIndex=i;break}}
 if(markerIndex<0)throw Error('Native capture synchronization marker missing')
 const videoOrigin=marker-timing[markerIndex],videoStart=songZero-videoOrigin,audioStart=songZero-audioOrigin
 const selected=timing.filter(t=>t>=videoStart&&t<videoStart+duration),gaps=selected.slice(1).map((t,i)=>t-selected[i]),maxGap=Math.max(...gaps)
 const raf=stats.filter(s=>s.wall>=songZero&&s.wall<songZero+duration),rafMaxGap=Math.max(...raf.map(s=>s.dt))
 if(videoStart<0||audioStart<0||maxGap>.1||rafMaxGap>100)throw Error(`Discontinuous recording: video ${Math.round(maxGap*1000)}ms, rAF ${Math.round(rafMaxGap)}ms`)
 const sourceAudio=await fs.readFile(path.join(output,'source.f32le')),start=Math.round(audioStart*sampleRate)*4,length=duration*sampleRate*4
 if(start+length>sourceAudio.length)throw Error('Audio does not cover the entire opening')
 await fs.writeFile(path.join(output,'preview-audio.f32le'),sourceAudio.subarray(start,start+length))
 const file=path.join(output,'komorebi-boom-boom-pow-optimized-40s.mp4')
 execFileSync('ffmpeg',['-y','-v','error','-i',rawVideo,'-f','f32le','-ar',String(sampleRate),'-ac','1','-i',path.join(output,'preview-audio.f32le'),'-filter_complex',`[0:v]trim=start=${videoStart}:duration=40,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v]`,'-map','[v]','-map','1:a','-af','volume=-1dB','-c:v','libx264','-crf','18','-preset','medium','-c:a','aac','-b:a','160k','-t','40','-movflags','+faststart',file])
 const verification=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=duration,nb_frames,width,height','-of','json',file],{encoding:'utf8'}))
 if(verification.streams.some(s=>Math.abs(Number(s.duration)-duration)>.01))throw Error('Exported streams are not exactly 40 seconds')
 const result={file,before,after,music,songZero,audioOrigin,sampleRate,audioSeconds:audioBytes/(sampleRate*4),videoOrigin,videoStart,audioStart,marker:{wall:marker,pts:timing[markerIndex]},captureFrames:selected.length,maxGapMs:maxGap*1000,rafMaxGapMs:rafMaxGap,bursts:[...bursts.values()].filter(b=>Number(b.fireworkAt)+rendererTimeOrigin>=songZero&&Number(b.fireworkAt)+rendererTimeOrigin<songZero+duration),rendererTimeOrigin,errors,verification,captureMethod:'native screencapture of the pet window; pre-roll marker alignment',syncMethod:'native marker, MediaRemote elapsedTimeNow and PCM first arrival minus block duration; approximate transport/compositor latency',audioGainDb:-1}
 await fs.writeFile(path.join(output,'recording-metadata.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result))
}finally{
 tap?.kill('SIGTERM');recorder?.kill('SIGTERM');if(audioFile&&!audioClosed)await audioFile.close().catch(()=>{});await evaluate("(()=>{document.getElementById('preview-sync')?.remove();if(window.__petPreviewStats){window.__petPreviewStats.running=false;delete window.__petPreviewStats}})()").catch(()=>{});ws.close()
}
