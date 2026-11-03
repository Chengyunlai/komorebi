<script setup>
import {computed,ref,onMounted,onBeforeUnmount} from 'vue'
import {playbackPosition,lyricAt} from './music-view'
const props=defineProps({audio:Object,music:Object,enabled:{type:Boolean,default:true}})
const now=ref(Date.now());let timer
const lyric=computed(()=>lyricAt(props.music?.lines||[],playbackPosition(props.music,now.value)))
const text=computed(()=>props.audio?.mode==='demo'?'跟着鼓点，轻轻摇摆':props.audio?.mode==='system'?(props.music?.title?props.music.title:'听到声音，我跟着回应'):props.enabled?(lyric.value.current||props.music?.title):props.music?.title)
const caption=computed(()=>{
 if(props.audio?.mode==='system')return '系统声音 · 仅本机分析'
 if(props.audio?.mode==='demo')return '原创节奏试跳 · 24秒'
 if(props.music?.preview)return '效果预览 · 无音频'
 if(!props.enabled)return props.music?.artist
 if(props.music?.status==='paused')return '已暂停'
 if(lyric.value.current)return '网易云 · '+props.music.title
 return ({loading:'正在同步歌词…',ambiguous:'多个歌曲版本，尚未匹配',unmatched:'尚未匹配到歌词',instrumental:'纯音乐',unavailable:'歌词暂不可用 · 可重新连接',synced:'等待歌词开始'}[props.music?.lyricState]||props.music?.artist)
})
onMounted(()=>{timer=setInterval(()=>{if(!document.hidden)now.value=Date.now()},200)})
onBeforeUnmount(()=>clearInterval(timer))
</script>
<template>
 <div v-if="music?.title||['demo','system'].includes(audio?.mode)" class="music-lyrics" :class="{paused:music.status!=='playing'}" aria-label="脚下同步歌词">
  <div class="lyric-content"><p class="lyric-line">{{text}}</p>
  <span class="lyric-caption">{{caption}}</span></div>
 </div>
</template>
