<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue'
const snapshot=ref(null),error=ref('')
let timer,disposed=false,busy=false
const number=value=>Number.isFinite(value)?value.toFixed(3):'—'
const support=value=>Array.isArray(value)?value.map(support).join(' / '):({left:'左脚',right:'右脚',both:'双脚',none:'无接触候选',unknown:'未知',flight:'腾空候选'}[value]||value||'—')
async function poll(){
 if(busy||disposed)return;busy=true
 try{const value=await window.komorebi?.danceStudySnapshot?.();if(!disposed){snapshot.value=value??null;error.value=''}}
 catch{if(!disposed){snapshot.value=null;error.value='暂时无法读取桌面伙伴数据。'}}finally{busy=false}
}
onMounted(()=>{poll();timer=setInterval(poll,500)})
onBeforeUnmount(()=>{disposed=true;clearInterval(timer)})
</script>
<template>
 <section class="study-detail skeleton-detail beat-study" aria-label="音乐踩拍验证">
  <h2>看音乐拍如何映射到动作。</h2>
  <p>读取桌面伙伴当前播放状态，每 500ms 更新。请在音乐入口手动开始播放。</p>
  <p v-if="error" class="study-error" role="status">{{error}}</p>
  <p v-if="!snapshot?.available&&!snapshot?.execution" role="status">等待桌面伙伴的本地动作片段与音乐时钟数据…</p>
  <template v-if="snapshot">
   <div class="reference-stats">
    <div><b>{{snapshot.clip??'—'}}</b><span>当前片段</span></div>
    <div><b>{{number(snapshot.beat)}}</b><span>音乐拍 · 连续时钟</span></div>
    <div><b>{{number(snapshot.clipBeat)}}</b><span>动作拍 · 片段内</span></div>
    <div><b>{{number(snapshot.phaseError)}}</b><span>源帧量化误差 / 秒</span></div>
   </div>
   <div class="study-layers">
    <span>时钟 {{snapshot.timing||'—'}}</span><span>支撑脚候选 {{support(snapshot.support)}}</span><span>混合权重 {{number(snapshot.weight)}}</span><span>源帧 {{number(snapshot.sourceFrame)}}</span><span>时钟代次 {{snapshot.clockEpoch??'—'}}</span>
   </div>
   <p class="study-proof">源帧量化误差只描述时间映射的采样精度；混合和限速可能让实际落脚滞后，它不是最终脚底或听觉同步误差。tracking：跟踪估计节奏；estimated：估计时钟；preview：预览时钟。这里不识别强拍。</p>
   <template v-if="snapshot.execution"><div class="study-layers"><span>最终执行 {{snapshot.execution.finalWriter}}</span><span>世界对齐 {{snapshot.execution.worldAlignment}}</span><span>根策略 {{snapshot.execution.rootPolicy}}</span></div><div class="study-layers"><span>片段切换 {{snapshot.switches??0}}</span><span>轨迹原目标残差 / 米 {{number(snapshot.execution.desiredError)}}</span><span>可达域投影脚数 {{snapshot.execution.projectedCount??0}}</span><span>最大局部旋转改写 / 弧度 {{number(snapshot.execution.maxRotationRewriteRadians)}}</span></div><p class="study-proof">本地动作不再叠加旧接触锁脚。踝目标与姿态共同混合，估计接触仅用于时钟/选段诊断。离待机参考踝高 / 米：左 {{number(snapshot.footHeights?.left)}} · 右 {{number(snapshot.footHeights?.right)}}；此值不是脚底离地高度。</p></template>
   <template v-else><div class="study-layers"><span>片段切换 {{snapshot.switches??0}}</span><span>接触约束阻止切换 {{snapshot.blockedTransitions??0}}</span><span>脚踝目标残差 / 米 {{number(snapshot.contactError)}}</span></div><div class="study-layers"><span>锁定成功 {{snapshot.contactLocked??0}}</span><span>跳过 {{snapshot.contactSkipped??0}}</span><span>不可达 {{snapshot.contactRejected??0}}</span><span>脚踝离参考面 / 米：左 {{number(snapshot.footHeights?.left)}} · 右 {{number(snapshot.footHeights?.right)}}</span></div></template>
   <p class="study-proof" v-if="snapshot.lastLanding">最近可见落脚估计：{{support(snapshot.lastLanding.side)}} · 音乐拍 {{number(snapshot.lastLanding.beat)}} · 距最近整数拍 {{number(snapshot.lastLanding.offsetBeats)}} 拍。依据脚踝高度阈值，仍非力学接触测量。</p>
   <h3>本地片段与拍点锚点</h3>
   <p>接触方法：{{snapshot.contactMethod==='source-kinematic-estimate-no-lock'?'源运动学估计，不用于锁脚':snapshot.contactMethod==='automatic-estimate'?'自动估计':snapshot.contactMethod||'等待数据'}}。锚点由动作数据推导，支撑脚为接触候选，不表示真实承重。</p>
   <div class="beat-table-wrap">
    <table>
     <caption class="study-proof">片段范围、拍长及自动估计锚点</caption>
     <thead><tr><th scope="col">片段</th><th scope="col">源帧范围</th><th scope="col">拍长</th><th scope="col">活跃度</th><th scope="col">锚点：拍 / 源帧 / 脚</th></tr></thead>
     <tbody><tr v-for="clip in snapshot.clips||[]" :key="clip.id"><th scope="row">{{clip.id}}</th><td>{{clip.start}} – {{clip.end}}</td><td>{{number(clip.beats)}}</td><td>{{number(clip.activity)}}</td><td><span v-for="(anchor,index) in clip.anchors||[]" :key="index" class="beat-anchor">{{number(anchor.beat)}} / {{anchor.frame}} / {{support(anchor.side)}}</span><span v-if="!clip.anchors?.length">暂无锚点</span></td></tr></tbody>
    </table>
   </div>
  </template>
 </section>
</template>
<style scoped>
.beat-study{flex:1;padding:0 4px 16px}.beat-study .study-layers{gap:12px 22px}.beat-table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font:11px/1.7 ui-monospace,'PingFang SC',monospace;text-align:left}caption{text-align:left}th,td{padding:10px 12px;border-bottom:1px solid #dfe5ec;vertical-align:top}th{font-weight:500;color:#516a83}.beat-anchor{display:block;white-space:nowrap}.beat-study .reference-stats{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.beat-study .reference-stats b{font-size:23px}
</style>
