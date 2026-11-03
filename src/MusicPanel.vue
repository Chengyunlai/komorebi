<script setup>
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
import {Music2,X,Play,Pause,SkipBack,SkipForward,RefreshCw,ExternalLink} from 'lucide-vue-next'
import {playbackPosition,lyricAt} from './music-view'
const props=defineProps({music:Object,audio:Object,behavior:Object})
const instruction=ref(''),decision=ref(''),deciding=ref(false)
async function direct(){
 deciding.value=true;decision.value='Laya 本地判断中，首次需要加载模型…'
 try{const r=await window.komorebi.behaviorDecide(instruction.value);decision.value=r.accepted?`${r.state.label} · ${Math.round(r.confidence*100)}% · ${r.elapsedMs}ms`:'未执行：没有识别为明确舞动指令，或置信度不足。'}catch(e){decision.value=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'')}finally{deciding.value=false}
}
const api=window.komorebi,error=ref(''),busy=ref(false),now=ref(Date.now());let timer
const motionStatus=computed(()=>['demo','netease','system'].includes(props.audio?.mode)?props.audio?.signal?.state==='silent'?'音频静音 · 收势':props.audio?.status==='active'?'音频驱动 · 连续舞句 · 节拍估计':'等待真实音频 · 不播放固定动作':['gentle','energetic'].includes(props.behavior?.choice)?'无音乐动作试跳 · 固定节奏':'未开启音频驱动')
const isDemo=computed(()=>props.audio?.mode==='demo')
const duration=computed(()=>isDemo.value?24:props.music.duration)
const position=computed(()=>isDemo.value?(props.audio?.signal?.sampleFrame||0)/(props.audio?.signal?.sampleRate||48000):playbackPosition(props.music,now.value))
const line=computed(()=>lyricAt(props.music.lines||[],position.value).current)
const controllable=computed(()=>!isDemo.value&&!props.music.preview&&['playing','paused'].includes(props.music.status))
const status=computed(()=>isDemo.value?'原创音频与信号演示':props.music.preview?'效果预览':({playing:'正在播放',paused:'已暂停',idle:'等待网易云播放',waiting:'连接网易云中',unavailable:'暂未连接',disabled:'音乐陪伴已关闭'}[props.music.status]||'等待网易云播放'))
const time=n=>`${Math.floor((n||0)/60)}:${String(Math.floor((n||0)%60)).padStart(2,'0')}`
async function act(fn){error.value='';busy.value=true;try{await fn()}catch(e){error.value=e.message.replace(/^Error invoking remote method '[^']+': Error: /,'')}finally{busy.value=false}}
onMounted(()=>timer=setInterval(()=>now.value=Date.now(),300))
onBeforeUnmount(()=>clearInterval(timer))
</script>
<template>
 <section class="music-panel">
  <header><span><Music2 :size="15"/>网易云音乐</span><button title="收起音乐入口" @click="api.hideMusic()"><X :size="14"/></button></header>
  <div class="music-track"><span class="music-source-state"><i class="tiny-dot" :class="{busy:music.status==='playing'}"/>{{status}}</span><h1>{{isDemo?'原创节奏试跳':music.title||'一起听一首歌。'}}</h1><p>{{isDemo?'90 → 120 → 140 BPM · 含静音段':music.artist||'在网易云客户端播放，木漏日跟着陪伴。'}}</p></div>
  <p class="music-panel-line">{{error||(isDemo?'同一份原创音频同时用于播放和分析。':line||music.message)}}</p>
  <div class="music-progress"><i :style="{width:Math.min(100,position/(duration||1)*100)+'%'}"/></div><div class="music-times"><span>{{time(position)}}</span><span>{{time(duration)}}</span></div>
  <div class="music-commands"><button title="上一首" :disabled="!controllable||busy" @click="act(()=>api.musicControl('previous'))"><SkipBack :size="17"/></button><button class="music-play" :title="music.status==='playing'?'暂停网易云音乐':'播放网易云音乐'" :disabled="!controllable||busy" @click="act(()=>api.musicControl('toggle'))"><Pause v-if="music.status==='playing'" :size="18"/><Play v-else :size="18"/></button><button title="下一首" :disabled="!controllable||busy" @click="act(()=>api.musicControl('next'))"><SkipForward :size="17"/></button></div>
  <div class="audio-controls"><button @click="act(()=>audio.mode==='netease'&&audio.status!=='error'?api.musicAudioStop():api.musicAudioStart('netease'))">{{audio.mode==='netease'&&audio.status!=='error'?'停止跟拍':'真实音频跟拍'}}</button><button @click="act(()=>audio.mode==='system'&&audio.status!=='error'?api.musicAudioStop():api.musicAudioStart('system'))">{{audio.mode==='system'&&audio.status!=='error'?'停止跟拍':'系统声音跟拍'}}</button><button @click="act(()=>audio.mode==='demo'?api.musicAudioStop():api.musicAudioStart('demo'))">{{audio.mode==='demo'?'结束试跳':'原创节奏试跳'}}</button></div>
  <progress v-if="audio.signal" class="audio-energy" max="1" :value="audio.signal.energy" aria-label="音频输入强度"/>
  <p class="audio-status">{{motionStatus}} · {{audio.signal?.tempo?.confidence>.55?Math.round(audio.signal.tempo.bpm)+' BPM · ':''}}{{audio.message||'音频跟拍未开启'}}</p>
  <form class="behavior-controls" @submit.prevent="direct"><label for="behavior-input">Laya 行为试用 · {{behavior?.label||'默认律动'}}</label><div><input id="behavior-input" v-model="instruction" maxlength="1500" placeholder="轻轻跳 / 活泼一点 / 停止跳舞" aria-label="Laya 行为指令"/><button :disabled="deciding||!instruction.trim()">{{deciding?'判断中':'试试'}}</button></div><p role="status">{{decision||motionStatus}}</p></form>
  <footer><button @click="act(()=>api.openMusicPlayer())">打开网易云<ExternalLink :size="11"/></button><button title="重新连接音乐状态" @click="act(()=>api.musicRefresh())"><RefreshCw :size="13"/></button></footer>
 </section>
</template>
