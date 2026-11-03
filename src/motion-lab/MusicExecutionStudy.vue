<script setup>
import {computed,onBeforeUnmount,ref,shallowRef} from 'vue'
import Character from '../Character.vue'
import {MusicAnalyzer} from '../../electron/vendor/music-signal/analyzer.mjs'
import {demoBlock} from '../../electron/vendor/music-signal/demo-audio.mjs'
const rootPolicy=ref('in-place-feet-midpoint'),rootCompilation=shallowRef(null),executionLimiter=ref('legacy')
const assessmentBeats=ref(.3),assessmentTransition=ref('static'),character=ref(null),diagnosing=ref(false),diagnosticProgress=ref(''),limiterAssessment=shallowRef(null)
const ready=ref(false),running=ref(false),elapsed=ref(0),featureCount=ref(0),failure=ref(''),fullReplay=ref(false),fullDuration=ref(63),plannedInfo=shallowRef(null),gateEnabled=ref(false),realMusic=ref(false)
const audio=shallowRef({mode:'off',signal:null,receivedAt:0}),report=shallowRef(null)
const stats=ref(freshStats())
function freshStats(){return {reports:0,maxDesiredError:0,maxRotationRewriteRadians:0,maxProjectedCount:0,observedBPM:[],quietWindows:{'14–16s':[],'24–27s':[]},afterStop:null,activeReportCount:0,legacyContactViolations:0,executionModes:[],worldAlignments:[],bankExecutions:[],limiterModes:[],transitionPolicies:[],lastSourceFrame:null}}
const summary=computed(()=>{const r=report.value,e=r?.execution;return {mode:e?.mode,worldAlignment:e?.worldAlignment,rootPolicy:e?.rootPolicy,legacyContactApplied:e?.legacyContactApplied,desiredError:e?.desiredError,projectedFeet:e?.projectedCount,weight:r?.weight,clip:r?.clip}})
const number=value=>Number.isFinite(value)?value.toFixed(3):'—'
let diagnosticAbort,analyzer,frame=0,startedAt=0,raf=0,streamGeneration=0,disposed=false,hasRun=false,removeMusicListener=null,realSamples=[],lastReplan=0,realTimer=0
const sampleRate=24000,blockSize=800,totalFrames=sampleRate*27
function receiveReport(value){
 report.value=value
 if(!hasRun)return
 const e=value.execution||{},s=stats.value
 s.reports++;if(value.weight>0)s.activeReportCount++;if(e.legacyContactApplied!==false)s.legacyContactViolations++;for(const [key,v] of [['executionModes',e.mode],['worldAlignments',e.worldAlignment],['bankExecutions',e.bankExecution],['limiterModes',e.limiter?.mode],['transitionPolicies',e.transitionPolicy]])if(v!==undefined&&!s[key].includes(v))s[key].push(v);s.lastSourceFrame=value.sourceFrame;s.maxDesiredError=Math.max(s.maxDesiredError,e.desiredError||0);s.maxRotationRewriteRadians=Math.max(s.maxRotationRewriteRadians,e.maxRotationRewriteRadians||0);s.maxProjectedCount=Math.max(s.maxProjectedCount,e.projectedCount||0)
 if(Number.isFinite(value.musicBpm)){const bpm=Math.round(value.musicBpm*100)/100;if(!s.observedBPM.includes(bpm))s.observedBPM.push(bpm)}
 const point={elapsed:Number(elapsed.value.toFixed(3)),weight:value.weight,mode:e.mode,source:value.motionSource,energy:audio.value.signal?.energy}
 if(running.value&&elapsed.value>=14&&elapsed.value<16)s.quietWindows['14–16s'].push(point)
 if(running.value&&elapsed.value>=24)s.quietWindows['24–27s'].push(point)
 if(!running.value)s.afterStop=point
}
function stop(){cancelAnimationFrame(raf);raf=0;clearInterval(realTimer);realTimer=0;running.value=false;fullReplay.value=false;gateEnabled.value=false;if(realMusic.value)cleanupReal();audio.value={mode:'off',signal:null,receivedAt:performance.now()}}
function tick(now){
 if(disposed||!running.value)return
 if(realMusic.value){
  elapsed.value=(now-startedAt)/1000
  if(elapsed.value-lastReplan>=10&&realSamples.length){lastReplan=elapsed.value;try{const music=describeRealMusic(realSamples.slice(-90));character.value.extendPlannedPlan({music}).then(result=>{if(result)plannedInfo.value={...plannedInfo.value,extensions:(plannedInfo.value.extensions||0)+1,lastSummary:result.planSummary}}).catch(error=>console.info('[extend-error]',error.message))}catch{}}
  if(elapsed.value>=120){stop();return}
  return
 }
 if(fullReplay.value){elapsed.value=Math.min(fullDuration.value,(now-startedAt)/1000);if(elapsed.value>=fullDuration.value){stop();return}raf=requestAnimationFrame(tick);return}
 elapsed.value=Math.min(27,(now-startedAt)/1000)
 const target=Math.min(totalFrames,Math.floor(elapsed.value*sampleRate/blockSize)*blockSize)
 try{
  while(frame<target){const count=Math.min(blockSize,target-frame);const packets=analyzer.push({mono:demoBlock(frame,count,sampleRate),startFrame:frame});frame+=count
   for(const packet of packets)if(packet.type==='features'){featureCount.value++;audio.value={mode:'demo',signal:packet,receivedAt:performance.now()}}
  }
 }catch(error){failure.value=error.message;stop();return}
 if(frame>=totalFrames){stop();return}raf=requestAnimationFrame(tick)
}
async function compileRoots(){if(!ready.value||running.value||diagnosing.value||(report.value?.weight??0)>0)return;diagnosing.value=true;failure.value='';try{rootCompilation.value=await character.value.configureRootTrajectory({rootPolicy:rootPolicy.value});report.value=null;limiterAssessment.value=null}catch(e){failure.value=e.message}finally{diagnosing.value=false}}
async function diagnose(){if(!ready.value||running.value||diagnosing.value)return;diagnosing.value=true;failure.value='';limiterAssessment.value=null;diagnosticAbort=new AbortController();try{limiterAssessment.value=await character.value.assessLimiterStages({transitionPolicy:assessmentTransition.value,transitionBeats:assessmentBeats.value,signal:diagnosticAbort.signal,onProgress:value=>{diagnosticProgress.value=JSON.stringify(value)}})}catch(e){if(e.name!=='AbortError')failure.value=e.message}finally{diagnosing.value=false}}
async function analyzeDemoMusic(){
 const analyzer=new MusicAnalyzer({sampleRate,featureHz:30,streamId:'planned-analysis'})
 const energy=[];let frame=0,lastT=0;const bpms=[]
 while(frame<totalFrames){
  const packets=analyzer.push({mono:demoBlock(frame,blockSize,sampleRate),startFrame:frame});frame+=blockSize
  for(const packet of packets)if(packet.type==='features'){const t=packet.sampleFrame/sampleRate;if(t-lastT>=.5){energy.push({time:Number(t.toFixed(2)),value:Number(packet.energy.toFixed(3))});lastT=t}if(packet.tempo?.confidence>.55)bpms.push(packet.tempo.bpm)}
 }
 const sorted=bpms.sort((a,b)=>a-b)
 return {bpm:sorted.length?Math.round(sorted[Math.floor(sorted.length/2)]):120,duration:Number((totalFrames/sampleRate).toFixed(2)),energy}
}
function describeRealMusic(samples){
 const usable=samples.filter(sample=>Number.isFinite(sample.bpm)&&(sample.confidence??0)>=.55).map(sample=>sample.bpm).sort((a,b)=>a-b)
 const bpm=usable.length?Math.round(usable[Math.floor(usable.length/2)]):120
 const energy=[];let lastTime=-1
 for(const sample of samples){if(sample.time-lastTime>=.5){energy.push({time:Number((sample.time-samples[0].time).toFixed(2)),value:Number((sample.energy??.5).toFixed(3))});lastTime=sample.time}}
 const duration=Math.max(6,(energy.at(-1)?.time??0)+.5)+45
 // Extend the measured energy to the whole horizon so the planner covers it instead of
 // treating the last measured second as the end of the music.
 const lastPoint=energy.at(-1)
 if(lastPoint)for(let time=lastPoint.time+.5;time<=duration;time+=.5)energy.push({time:Number(time.toFixed(2)),value:lastPoint.value})
 return {bpm,duration,energy}
}
function cleanupReal(){removeMusicListener?.();removeMusicListener=null;try{window.komorebi.musicAudioStop()}catch{};realMusic.value=false}
async function startRealMusic(){
 if(!ready.value||running.value||diagnosing.value)return
 diagnosing.value=true;failure.value=''
 audio.value={mode:'off',signal:null,receivedAt:performance.now()}
 try{
  await window.komorebi.musicAudioStart('system')
  realSamples=[]
  removeMusicListener=window.komorebi.on('music-signal',state=>{if(state.signal){realSamples.push({time:performance.now()/1000,state:state.signal.state,confidence:state.signal.tempo?.confidence??null,bpm:state.signal.tempo?.bpm??null,energy:state.signal.energy});audio.value={mode:'system',signal:state.signal,receivedAt:performance.now()}}})
  await new Promise(resolve=>setTimeout(resolve,6500))
  if(!realSamples.length)throw Error('没有收到系统音频；请先播放音乐并确认已授权系统声音')
  const music=describeRealMusic(realSamples)
  plannedInfo.value={music,...await character.value.configurePlannedPhrases({music}),real:true}
 }catch(e){failure.value=e.message;diagnosing.value=false;cleanupReal();return}
 diagnosing.value=false
 realMusic.value=true;gateEnabled.value=true;lastReplan=0;stats.value=freshStats();featureCount.value=0;elapsed.value=0;frame=0;failure.value='';hasRun=true
 startedAt=performance.now();running.value=true;realTimer=setInterval(()=>tick(performance.now()),33)
}
async function startPlanned(){
 if(!ready.value||running.value||diagnosing.value)return
 diagnosing.value=true;failure.value=''
 try{const music=await analyzeDemoMusic();plannedInfo.value={music,...await character.value.configurePlannedPhrases({music})}}
 catch(e){failure.value=e.message;diagnosing.value=false;return}
 diagnosing.value=false
 stats.value=freshStats();featureCount.value=0;elapsed.value=0;frame=0;failure.value='';hasRun=true;gateEnabled.value=false
 analyzer=new MusicAnalyzer({sampleRate,featureHz:30,streamId:`execution-study-${++streamGeneration}`})
 audio.value={mode:'demo',signal:null,receivedAt:performance.now()};startedAt=performance.now();running.value=true;raf=requestAnimationFrame(tick)
}
async function startFull(){
 if(!ready.value||running.value||diagnosing.value)return
 try{const compiled=await character.value.configureFullReplay({rootPolicy:rootPolicy.value});fullDuration.value=compiled.clips[0]?Math.round((compiled.clips[0].end+1)/15*10)/10:63;rootCompilation.value=compiled}catch(e){failure.value=e.message;return}
 stats.value=freshStats();featureCount.value=0;elapsed.value=0;failure.value='';hasRun=true
 fullReplay.value=true;gateEnabled.value=false;audio.value={mode:'off',signal:null,receivedAt:performance.now()};startedAt=performance.now();running.value=true;raf=requestAnimationFrame(tick)
}
function start(){
 if(!ready.value||running.value||diagnosing.value)return
 try{character.value.configureDanceExecution({limiterMode:executionLimiter.value,transitionPolicy:assessmentTransition.value,transitionBeats:assessmentBeats.value})}catch(e){failure.value=e.message;return}
 stats.value=freshStats();featureCount.value=0;elapsed.value=0;frame=0;failure.value='';hasRun=true
 analyzer=new MusicAnalyzer({sampleRate,featureHz:30,streamId:`execution-study-${++streamGeneration}`})
 audio.value={mode:'demo',signal:null,receivedAt:performance.now()};startedAt=performance.now();running.value=true;raf=requestAnimationFrame(tick)
}
onBeforeUnmount(()=>{disposed=true;diagnosticAbort?.abort();stop()})
</script>
<template>
 <section class="music-execution-study" aria-label="音乐执行验证">
  <header><h2>音乐分析 → 角色执行</h2><p>原创 PCM 实际分析 / 无外放。24 秒确定性音频，14–16 秒静音，随后继续输入 3 秒零信号；完整运行 27 秒。</p></header>
  <div class="execution-grid">
   <div class="execution-preview"><Character ref="character" :active="true" :pet="false" :audio="audio" :behavior="{choice:'default'}" :dance-enabled="true" :tempo="100" :music="{}" :full-replay="fullReplay" :reliability-gate="gateEnabled" @ready="ready=true" @dance-frame="receiveReport" /></div>
   <div class="execution-detail">
    <label>本页根轨迹 <select v-model="rootPolicy" aria-label="根轨迹实验策略" :disabled="!ready||running||diagnosing"><option value="in-place-feet-midpoint">当前双踝居中</option><option value="source-smoothed-presentation">源运动＋独立平滑呈现 · 实验</option></select></label>
    <button aria-label="编译根轨迹对照" :disabled="!ready||running||diagnosing||(report?.weight??0)>0" @click="compileRoots">编译所选根轨迹</button>
    <label>本页实时验证限速策略 <select v-model="executionLimiter" aria-label="实时验证限速策略" :disabled="!ready||running||diagnosing"><option value="legacy">原独立限速</option><option value="planned-lower-body">计划下身 · 实验</option><option value="coherent-lower-body">一致下身 · 实验</option></select></label><div class="execution-controls"><button type="button" aria-label="运行音乐执行验证" :disabled="!ready||running||diagnosing||(report?.weight??0)>0" @click="start">{{running?'验证运行中…':'运行音乐执行验证'}}</button><button v-if="running" type="button" @click="stop">停止</button><button type="button" aria-label="完整舞段回放" :disabled="!ready||running||diagnosing||(report?.weight??0)>0" @click="startFull">{{running&&fullReplay?'完整回放中…':'完整回放 · 全段舞步'}}</button><button type="button" aria-label="音乐规划执行" :disabled="!ready||running||diagnosing||(report?.weight??0)>0" @click="startPlanned">{{diagnosing?'规划中…':'音乐规划执行 · 展开舞句'}}</button><button type="button" aria-label="真实音乐执行" :disabled="!ready||running||diagnosing||(report?.weight??0)>0" @click="startRealMusic">{{realMusic?'真实音乐中…':diagnosing?'准备中…':'真实音乐 · 系统声音'}}</button></div>
    <div class="execution-controls"><label>评估过渡方式 <select v-model="assessmentTransition" aria-label="评估过渡方式" :disabled="!ready||running||diagnosing"><option value="static">静态首帧 · 原基线</option><option value="heading-preroll">朝向对齐＋运动预备段</option></select></label><label>过渡拍长 <select v-model.number="assessmentBeats" aria-label="评估过渡拍长" :disabled="!ready||running||diagnosing"><option :value=".3">0.3 拍</option><option :value=".6">0.6 拍</option><option :value="1">1 拍</option></select></label><button aria-label="分层评估动作限速" :disabled="!ready||running||diagnosing" @click="diagnose">{{diagnosing?'分层评估中…':'分层评估动作限速'}}</button></div><p v-if="diagnosing" role="status">{{diagnosticProgress}}</p><details v-if="limiterAssessment"><summary>分层归因与目标滞后 JSON</summary><pre>{{JSON.stringify(limiterAssessment,null,2)}}</pre></details><div v-if="plannedInfo" class="planned-info"><p>音乐规划：{{plannedInfo.planSummary?.phraseCount}} 句 · 不同源句 {{plannedInfo.planSummary?.uniqueSources}} · 重复 {{plannedInfo.planSummary?.repeats}} · 重音误差 {{plannedInfo.planSummary?.medianAccentToBeatErrorMs}}ms · BPM {{plannedInfo.music?.bpm}}</p><p v-if="report?.planned">当前：第 {{report.planned.phraseIndex+1}} 句 · 源句 {{report.planned.sourcePhrase}} · 伸缩 {{report.planned.timeScale}}× · 模式 {{report.planned.musicMode}} · {{report.planned.reason}}</p><p v-if="plannedInfo?.real && running">真实音频：BPM {{plannedInfo.music?.bpm}} · 已规划 {{plannedInfo.extensions||0}} 次扩展 · {{realMusic?'系统声音采集中':''}}</p><p v-if="report?.reliability">信号门控：{{report.reliability.mode==='beat-aligned'?'拍对齐（可靠）':'反应式降级'}} · {{report.reliability.reason}} · tracking {{number(report.reliability.trackingRatio)}} · 置信度 {{number(report.reliability.confidenceMedian)}}</p></div><p role="status">{{ready?'角色已就绪':'正在加载实际角色与动作…'}} · {{number(elapsed)}} / 27 秒 · features {{featureCount}} · 模式 {{fullReplay?'完整回放':'音乐执行'}}</p>
    <p v-if="failure" role="alert">{{failure}}</p>
    <dl><dt>BPM / 来源</dt><dd>{{number(report?.musicBpm)}} / {{report?.motionSource||'—'}}</dd><dt>Stream</dt><dd>{{audio.signal?.streamId||'—'}}</dd><dt>执行 / 世界对齐</dt><dd>{{summary.mode||'—'}} / {{summary.worldAlignment||'—'}}</dd><dt>Root policy</dt><dd>{{summary.rootPolicy||'—'}}</dd><dt>Legacy contact applied</dt><dd>{{summary.legacyContactApplied??'—'}}</dd><dt>目标误差 / 投影脚数</dt><dd>{{number(summary.desiredError)}} / {{summary.projectedFeet??'—'}}</dd><dt>混合权重 / 片段</dt><dd>{{number(summary.weight)}} / {{summary.clip??'—'}}</dd></dl>
    <p>累计 {{stats.reports}} 份执行报告 · 最大目标误差 {{number(stats.maxDesiredError)}} m · 最大旋转重写 {{number(stats.maxRotationRewriteRadians)}} rad</p>
    <details><summary>当前执行报告 JSON</summary><pre>{{JSON.stringify(report,null,2)}}</pre></details>
    <details><summary>累计验证数据与静音窗口权重</summary><pre>{{JSON.stringify(stats,null,2)}}</pre></details>
    <p class="execution-note">使用实际 Character 日常渲染链与 MusicAnalyzer。本页选择仅作用于本页，不改桌宠主窗口或保存设置。节奏来自 PCM 检测；BPM 是估计值，投影脚数和目标误差属于运动学诊断。停止后继续接收角色报告以观察淡出。</p>
   <details v-if="rootCompilation"><summary>根轨迹编译 JSON</summary><pre>{{JSON.stringify(rootCompilation,null,2)}}</pre></details></div>
  </div>
 </section>
</template>
<style scoped>
.music-execution-study{width:100%;min-width:0;padding-bottom:20px}h2{margin:0 0 10px;font-size:24px}header p,.execution-note{color:#657587;font-size:12px;line-height:1.7}.execution-grid{display:grid;grid-template-columns:minmax(250px,1fr) minmax(300px,1fr);gap:24px}.execution-preview{height:480px;min-width:0;border:1px solid #dfe5ec;border-radius:16px;background:linear-gradient(#f3f7fa,#e9eff5);overflow:hidden;position:relative}.execution-preview :deep(.character){width:100%;height:100%}.execution-detail{height:480px;overflow:auto;padding:0 8px 16px;box-sizing:border-box;min-width:0;font-size:12px;line-height:1.7}.execution-controls{display:flex;gap:8px}button{border:1px solid #c6d2df;border-radius:8px;padding:9px 14px;background:#fff;color:#29435e;cursor:pointer}button:disabled{opacity:.5;cursor:default}dl{display:grid;grid-template-columns:145px minmax(0,1fr);gap:6px 10px}dt{color:#657587}dd{margin:0;overflow-wrap:anywhere}details{border-top:1px solid #dfe5ec;padding:10px 0}summary{cursor:pointer;color:#29435e}pre{font-size:10px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:0}@media(max-width:760px){.execution-grid{grid-template-columns:1fr}.execution-detail{height:auto;max-height:480px}.execution-preview{height:480px}}
</style>
