<script setup>
import {ref,reactive,computed,watch,onMounted,onBeforeUnmount} from 'vue'
import MotionStage from './MotionStage.vue'
import SkeletonStage from './SkeletonStage.vue'
import VRMStage from './VRMStage.vue'
import BeatStudy from './BeatStudy.vue'
import ReplayStudy from './ReplayStudy.vue'
import MaterialStudy from './MaterialStudy.vue'
import MusicExecutionStudy from './MusicExecutionStudy.vue'
import {parseMotion,curvePath,sampleCurve,speedMarkers} from './curves.mjs'
import {RETARGET_IDS} from './retarget.mjs'
import {parseBVH,skeletonAt} from './bvh.mjs'
import './study.css'
const tab=ref('live2d'),selected=ref('hiyori_m05'),source=ref(null),motion=ref(null),rig=ref([]),time=ref(0),playing=ref(true),speed=ref(1),physics=ref(true),error=ref(''),bvh=ref(null),reference=ref(null),parity=ref(0),showAll=ref(false)
const vrmInfo=ref(null),vrmFrame=ref(null)
const targetSource=ref(null),targetMotion=ref(null),targetStats=ref(null),targetBusy=ref(false),gain=ref(1),mirror=ref(false),closeup=ref(true),targetFrame=reactive({actual:{},parity:0})
const frame=reactive({raw:{},actual:{}}),layers=reactive({head:true,body:true,arms:true,face:true,other:true})
const groupNames={head:'头与视线',body:'躯干与呼吸',arms:'双臂',face:'表情',other:'其他参数'}
let ticker,lastTime=0,loadEpoch=0,lastDiagnostic=0,targetWorker=null,lastTargetKey=''
const duration=computed(()=>tab.value==='live2d'?motion.value?.duration||1:tab.value==='retarget'?targetMotion.value?.duration||bvh.value?.duration||1:bvh.value?.duration||1)
const visible=computed(()=>motion.value?.curves.filter(c=>c.target==='Parameter'&&(showAll.value||['ParamAngleX','ParamAngleY','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamArmLA','ParamArmRA'].includes(c.id))).map(c=>{
 const r=rig.value.find(r=>r.id===c.id)||{min:-30,max:30,neutral:0};return {...c,range:r,path:curvePath(c,r,600,38,motion.value.duration)}
})||[])
const markers=computed(()=>motion.value?speedMarkers(motion.value):[])
const bvhFrame=computed(()=>bvh.value?skeletonAt(bvh.value,time.value):null)
const armRows=computed(()=>bvh.value?.joints.filter(j=>/^(UpperArm|LowerArm|Hips|Spine|UpperLeg)/.test(j.name))||[])
const number=v=>Number.isFinite(v)?v.toFixed(2):'—'
async function load(){
 const epoch=++loadEpoch;error.value='';
 try{const response=await fetch(new URL(`./vendor/hiyori_free_zh/runtime/motion/${selected.value}.motion3.json`,location.href));if(!response.ok)throw Error('动作文件未加载');const data=await response.json();if(epoch!==loadEpoch)return;const parsed=parseMotion(data);source.value=data;motion.value=parsed;time.value=0;parity.value=0;frame.raw={};frame.actual={}}
 catch(e){error.value=e.message}
}
async function loadReference(){
 try{reference.value=await window.komorebi.motionReference();if(reference.value.text){bvh.value=parseBVH(reference.value.text);if(tab.value==='vrm')time.value=9.2}else error.value='本机尚未安装研究用BVH参考；日和动作页仍可使用。'}catch(e){error.value=e.message}
}
function chooseTab(value){tab.value=value;time.value=value==='vrm'?9.2:0;playing.value=true;error.value='';if(value!=='live2d'&&value!=='beat'&&value!=='replay'&&value!=='material'&&value!=='execution'&&!bvh.value)loadReference()}
function buildTarget(){
 if(tab.value!=='retarget'||!bvh.value||!rig.value.length)return
 const key=JSON.stringify({gain:gain.value,mirror:mirror.value,rig:rig.value.map(r=>[r.id,r.min,r.max,r.neutral])});if(key===lastTargetKey)return;lastTargetKey=key
 targetWorker?.terminate();targetBusy.value=true;error.value='';playing.value=false
 const worker=new Worker(new URL('./retarget-worker.mjs',import.meta.url),{type:'module'});targetWorker=worker
 worker.onmessage=({data})=>{if(targetWorker!==worker)return;targetBusy.value=false;if(data.error){error.value=data.error;lastTargetKey=''}else{targetSource.value=data.source;targetMotion.value=parseMotion(data.source);targetStats.value=data.stats;time.value=data.stats.firstActiveTime||0;playing.value=true}worker.terminate();targetWorker=null}
 worker.onerror=()=>{if(targetWorker!==worker)return;targetBusy.value=false;lastTargetKey='';error.value='动作映射生成失败';worker.terminate();targetWorker=null}
 worker.postMessage({bvh: {joints:bvh.value.joints.map(j=>({...j,offset:[...j.offset],channels:[...j.channels]})),channelCount:bvh.value.channelCount,frameCount:bvh.value.frameCount,frameTime:bvh.value.frameTime,duration:bvh.value.duration,values:bvh.value.values},rig:rig.value.map(r=>({...r})),options:{gain:gain.value,mirror:mirror.value}})
}
watch(()=>[tab.value,bvh.value,rig.value,gain.value,mirror.value],buildTarget)
function receiveTarget(value){if(value.actual)targetFrame.actual=value.actual;if(Number.isFinite(value.parity))targetFrame.parity=value.parity}
function nextMotion(direction){selected.value=`hiyori_m0${(Number(selected.value.at(-1))-1+direction+8)%8+1}`;load()}
function receive(value){if(value.raw)frame.raw=value.raw;if(value.actual)frame.actual=value.actual;if(Number.isFinite(value.parity))parity.value=value.parity}
function solo(group){for(const key of Object.keys(layers))layers[key]=key===group}
function reset(){for(const key of Object.keys(layers))layers[key]=true}
function seek(value){time.value=Math.max(0,Math.min(duration.value,Number(value)));playing.value=false}
function step(direction){seek(time.value+direction/(tab.value==='live2d'?motion.value?.fps||30:1/bvh.value?.frameTime||30))}
function tick(now){if(tab.value==='beat'||tab.value==='replay'||tab.value==='material'||tab.value==='execution'){lastTime=now;ticker=requestAnimationFrame(tick);return}if(now-lastDiagnostic>750){lastDiagnostic=now;window.komorebi.motionLabReport({view:tab.value,motion:tab.value==='retarget'?'bvh-upperbody':selected.value,gain:gain.value,mirror:mirror.value,time:time.value,playing:playing.value,physics:physics.value,layers:{...layers},vrm:tab.value==='vrm'?{frame:vrmFrame.value?.frame,bones:vrmFrame.value?.bones,maxDirectionError:vrmFrame.value?.maxDirectionError}:null,parity:tab.value==='retarget'?targetFrame.parity:parity.value,actual:{...(tab.value==='retarget'?targetFrame.actual:frame.actual)}}).catch(()=>{})}if(lastTime&&playing.value){time.value+=Math.min((now-lastTime)/1000,.1)*speed.value;if(time.value>duration.value)time.value=0}lastTime=now;ticker=requestAnimationFrame(tick)}
function keydown(e){if(tab.value==='beat'||tab.value==='replay'||tab.value==='material'||tab.value==='execution')return;if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();playing.value=!playing.value}if(e.code==='ArrowRight'){e.preventDefault();step(1)}if(e.code==='ArrowLeft'){e.preventDefault();step(-1)}}
onMounted(()=>{document.title='木漏日 · 动作解剖';load();ticker=requestAnimationFrame(tick);document.addEventListener('keydown',keydown)})
onBeforeUnmount(()=>{cancelAnimationFrame(ticker);targetWorker?.terminate();document.removeEventListener('keydown',keydown)})
</script>
<template>
 <main class="motion-study">
  <header class="study-header"><div><span class="study-eyebrow">KOMOREBI / MOTION STUDY</span><h1>先看懂一个动作。</h1><p>播放原始数据，拆开身体层次，再讨论音乐如何组织动作。</p></div><nav aria-label="研究对象"><button :class="{selected:tab==='execution'}" @click="chooseTab('execution')">音乐执行 · 集成</button><button :class="{selected:tab==='material'}" @click="chooseTab('material')">材料 · 连续过渡</button><button :class="{selected:tab==='replay'}" @click="chooseTab('replay')">分层回放</button><button :class="{selected:tab==='beat'}" @click="chooseTab('beat')">音乐 · 踩拍验证</button><button :class="{selected:tab==='vrm'}" @click="chooseTab('vrm')">VRM · 全身试跳</button><button :class="{selected:tab==='live2d'}" @click="chooseTab('live2d')">日和 · 参数解剖</button><button :class="{selected:tab==='skeleton'}" @click="chooseTab('skeleton')">完整舞蹈 · 3D 参考</button><button :class="{selected:tab==='retarget'}" @click="chooseTab('retarget')">骨架 → 日和 · 映射</button></nav></header>
  <p v-if="error" class="study-error" role="alert">{{error}}</p>
  <MusicExecutionStudy v-if="tab==='execution'"/>
  <MaterialStudy v-else-if="tab==='material'"/>
  <ReplayStudy v-else-if="tab==='replay'"/>
  <BeatStudy v-else-if="tab==='beat'"/>
  <div class="study-layout" v-else-if="tab!=='retarget'&&tab!=='vrm'">
   <section class="study-preview">
    <div class="preview-label">{{tab==='live2d'?'原生 Cubism 动作播放':'BVH 全身骨架 · 不直接驱动日和'}}</div>
    <MotionStage v-if="tab==='live2d'&&motion" :source="source" :motion="motion" :time="time" :playing="playing" :speed="Number(speed)" :layers="layers" :physics="physics" @ready="rig=$event" @frame="receive" @error="error=$event"/>
    <SkeletonStage v-else-if="bvh" :bvh="bvh" :time="time"/>
    <p class="preview-note">{{tab==='live2d'?'屏蔽随机待机、鼠标跟随与额外呼吸叠加。这里只播放选中的原始动作。':'橙：手臂 · 蓝：腿脚 · 绿：躯干。已隐藏辅助根节点连线；这里只画人体骨架。'}}</p>
   </section>
   <section class="study-detail" v-if="tab==='live2d'">
    <div class="study-toolbar"><label>原始动作 <select v-model="selected" @change="load" aria-label="选择日和原始动作"><option v-for="i in 8" :value="`hiyori_m0${i}`">hiyori_m0{{i}} · {{[4.7,5.93,4.2,4.37,8.57,1.9,1.6,4.17][i-1]}}s</option></select><button @click="nextMotion(-1)" aria-label="上一个原始动作">←</button><button @click="nextMotion(1)" aria-label="下一个原始动作">→</button></label><label><input v-model="physics" type="checkbox"/>物理跟随</label><span>{{motion?.curves.filter(c=>c.target==='Parameter').length}} 条参数曲线 · {{motion?.fps}} fps</span></div>
    <div class="study-layers"><div v-for="(label,key) in groupNames" :key="key"><label><input type="checkbox" v-model="layers[key]"/>{{label}}</label><button @click="solo(key)" :aria-label="`只看${label}`">独看</button></div><button @click="reset">恢复全部</button></div>
    <div class="curve-heading"><span>蓝线：原始曲线　橙点：实际参数</span><label><input v-model="showAll" type="checkbox"/>显示全部参数</label></div>
    <div class="curve-list">
     <div class="curve-row" v-for="c in visible" :key="c.id" :class="{muted:!layers[c.group]}">
      <div class="curve-name"><strong>{{c.id}}</strong><small>{{groupNames[c.group]}} · {{c.range.min}} ～ {{c.range.max}}</small></div>
      <svg viewBox="0 0 600 38" preserveAspectRatio="none" role="img" :aria-label="c.id+' 原始参数曲线'"><line x1="0" x2="600" y1="19" y2="19" class="curve-grid"/><path :d="c.path" class="curve-path"/><line :x1="time/duration*600" :x2="time/duration*600" y1="0" y2="38" class="curve-playhead"/><circle :cx="time/duration*600" :cy="38-(Math.min(c.range.max,Math.max(c.range.min,frame.actual[c.id]??c.range.neutral))-c.range.min)/(c.range.max-c.range.min||1)*38" r="3" class="curve-actual"/></svg>
      <div class="curve-value"><b>{{number(frame.actual[c.id])}}</b><small>原始 {{number(sampleCurve(c,time))}}</small></div>
     </div>
    </div>
    <div class="study-markers"><strong>速度峰值定位</strong><button v-for="m in markers" @click="seek(m.time)">{{m.time.toFixed(2)}}s</button><p>只是曲线速度候选点，并非自动识别的舞蹈重拍或动作语义。</p></div>
    <p class="study-proof">SDK 与曲线采样最大差值：{{parity.toExponential(2)}} · 掩码前比较 / Core 范围限幅后。物理开启时橙点可能偏离原曲线；拖动定位的物理姿态有历史效应。</p>
   </section>
   <section class="study-detail skeleton-detail" v-else>
    <h2>一段完整的动作，先原样看。</h2><p>Bandai Namco Research · dance-short_normal_001</p>
    <div class="reference-stats" v-if="bvh"><div><b>{{bvh.duration.toFixed(2)}}s</b><span>完整舞蹈</span></div><div><b>{{bvh.frameCount}}</b><span>逐帧数据</span></div><div><b>{{bvh.channelCount}}</b><span>运动通道</span></div><div><b>{{bvh.joints.filter(j=>j.channels.length).length}}</b><span>带通道关节</span></div></div>
    <p>这里有肩、肘、手腕、髋、膝与踝。它们的协同是真实舞蹈参考，不能将这些通道数值原封不动写入 Live2D 参数。</p>
    <h3>当前帧的原始通道</h3><div class="bvh-channel-table" v-if="bvh"><div v-for="joint in armRows"><strong>{{joint.name}}</strong><span v-for="(channel,index) in joint.channels">{{channel}} {{number(bvh.values[bvhFrame.frame*bvh.channelCount+joint.channelStart+index])}}</span></div></div>
    <p class="reference-license">研究参考：CC BY-NC 4.0。本机单独存放，不包含在应用或源码压缩包。此处没有音乐，也不演示音乐与舞蹈的配对同步。</p>
   </section>
  </div>
  <div class="retarget-layout" v-else-if="tab==='vrm'">
   <section class="study-preview"><div class="preview-label">原始舞蹈骨架 · 同一时间轴</div><SkeletonStage v-if="bvh" :bvh="bvh" :time="time"/><p class="preview-note">橙：手臂 · 蓝：腿脚 · 绿：躯干。</p></section>
   <section class="study-preview"><div class="preview-label">Cute Model · Jessair / 本机导入</div><VRMStage v-if="bvh" :bvh="bvh" :time="time" :physics="physics" @ready="vrmInfo=$event" @frame="vrmFrame=$event" @error="error=$event"/><p class="preview-note">全身骨骼重定向 · 非音乐即兴生成</p></section>
   <section class="study-detail retarget-detail"><h2>让手臂和腿真正参与。</h2><p>相同参考舞蹈，同一播放时间。将关节方向映射到 VRM 标准骨骼；保留独立屈肘、屈膝和躯干动作。</p><p v-if="vrmInfo" class="retarget-ready">已载入角色 · {{vrmInfo.bones}} 个映射关节</p><label><input v-model="physics" type="checkbox"/>头发与衣物物理</label><div class="study-markers"><strong>观察动作</strong><button @click="seek(9.2)">9.2s 起舞</button><button @click="seek(18.17)">18.17s 举手</button></div><p>支持拖动时间轴、逐帧、慢放与转动观察角度。</p><p class="reference-license">角色 © Jessair。用户本机下载，禁止再分发；不随源码或应用包提供。</p><p class="reference-license">舞蹈参考 CC BY-NC 4.0，仅本机研究。当前为几何重定向，未加入脚底锁定、手指编舞和身体碰撞求解，可能出现滑步与穿模。</p></section>
  </div>
  <div class="retarget-layout" v-else>
   <section class="study-preview"><div class="preview-label">原始舞蹈骨架 · 同一时间轴</div><SkeletonStage v-if="bvh" :bvh="bvh" :time="time"/><p class="preview-note">保留完整骨架作对照；右侧人物只接收可表达的上半身特征。</p></section>
   <section class="study-preview"><div class="preview-label">日和 · 8 参数映射实验</div><MotionStage :source="targetSource" :motion="targetMotion" :time="time" :playing="playing&&!targetBusy" :speed="Number(speed)" :layers="{head:true,body:true,arms:true,face:true,other:true}" :physics="physics" :framing="closeup?'upper':'full'" label="日和舞蹈映射预览" @ready="rig=$event" @frame="receiveTarget" @error="error=$event"/><p class="preview-note">没有根节点摇摆补偿，没有添加腿部动作，也没有固定节奏动画。</p></section>
   <section class="study-detail retarget-detail"><h2>保留动作意图，接受角色上限。</h2><p>躯干建立局部坐标系，头部取相对躯干旋转，手臂取抬起角度。不是复制 BVH 的欧拉角数值。</p>
    <div class="retarget-controls"><label>动作增益 <input type="range" min="0" max="2" step=".1" :value="gain" @change="gain=Number($event.target.value)" aria-label="映射动作增益"/>{{gain.toFixed(1)}}×</label><label><input v-model="mirror" type="checkbox"/>左右镜像校验</label><label><input v-model="closeup" type="checkbox"/>上半身近景</label><label><input v-model="physics" type="checkbox"/>物理跟随</label></div>
    <p v-if="targetBusy" role="status">正在解析整段舞蹈并生成参数轨迹…</p><p v-else-if="targetStats" class="retarget-ready">{{targetStats.frames}} 帧 → {{targetStats.channels}} 个可动参数 · {{targetStats.duration.toFixed(2)}} 秒<br/>从 {{targetStats.firstActiveTime.toFixed(2)}}s 的明显动作前开始，可拖回0秒查看准备段。</p>
    <div v-for="id in RETARGET_IDS" :key="id" class="retarget-value"><strong>{{id}}</strong><b>{{number(targetFrame.actual[id])}}</b><small v-if="targetStats">原始映射超界 {{targetStats.clippedPercent[id].toFixed(1)}}%</small></div>
    <p class="study-proof">SDK / 曲线采样差值 {{targetFrame.parity.toExponential(2)}}。超界部分已平滑限幅，不通过整体窗口旋转放大效果。</p>
    <p class="reference-license">未映射：肘部独立弯曲、髋膝踝与步伐、根节点位移。这个角色没有对应的控制通道。</p><p class="reference-license">这页播放现成舞蹈，不是根据音乐即兴生成。研究动作仅本机内存生成，不打包分发。</p>
   </section>
  </div>
  <footer v-if="tab!=='beat'&&tab!=='replay'&&tab!=='material'&&tab!=='execution'" class="study-transport"><button @click="playing=!playing" :aria-label="playing?'暂停动作':'播放动作'">{{playing?'暂停':'播放'}}</button><button @click="step(-1)" title="前一帧">← 帧</button><button @click="step(1)" title="后一帧">帧 →</button><span class="study-time">{{time.toFixed(2)}} / {{duration.toFixed(2)}}s</span><input type="range" min="0" :max="duration" step="0.001" :value="time" @input="seek($event.target.value)" aria-label="动作时间轴"/><div class="study-speed" role="group" aria-label="动作播放速度"><button v-for="rate in [.25,.5,1,2]" :aria-pressed="speed===rate" :class="{chosen:speed===rate}" @click="speed=rate">{{rate}}×</button></div></footer>
 </main>
</template>
