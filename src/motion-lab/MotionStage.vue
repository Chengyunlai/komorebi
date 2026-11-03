<script setup>
import {ref,onMounted,onBeforeUnmount,watch} from 'vue'
import * as PIXI from 'pixi.js'
import {install} from '@pixi/unsafe-eval'
import {groupFor,sampleCurve} from './curves.mjs'
window.PIXI=PIXI;install({ShaderSystem:PIXI.ShaderSystem})
const props=defineProps({motion:Object,source:Object,time:Number,speed:Number,playing:Boolean,layers:Object,physics:Boolean,label:{type:String,default:'日和原始动作预览'},framing:{type:String,default:'full'}})
const emit=defineEmits(['frame','ready','error'])
const host=ref(null),canvas=ref(null);let app,model,observer,SDK,nativeMotion,entry,originalUpdate,originalNatural,originalPhysics,originalPose,lastReport=0,disposed=false
function loadMotion(){
 if(!SDK||!props.source)return
 nativeMotion=SDK.CubismMotion.create(props.source);nativeMotion.setIsLoop(false);nativeMotion.setFadeInTime(0);nativeMotion.setFadeOutTime(0);
 for(const c of props.motion.curves)if(c.target==='Parameter'){nativeMotion.setParameterFadeInTime(c.id,0);nativeMotion.setParameterFadeOutTime(c.id,0)}
 entry=new SDK.CubismMotionQueueEntry();entry.setStartTime(0);entry.setFadeInStartTime(0);entry.setEndTime(-1)
}
function fit(){if(!model||!host.value)return;const {width,height}=host.value.getBoundingClientRect();app.renderer.resize(width,height);model.scale.set(1);const close=props.framing==='upper';model.scale.set(Math.min(width/model.width,height/model.height)*.94*(close?1.7:1));model.anchor.set(.5,close?0:.5);model.position.set(width/2,close?height*.03:height/2)}
onMounted(async()=>{
 try{
  SDK=await import('pixi-live2d-display/cubism4');if(disposed)return;app=new PIXI.Application({view:canvas.value,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,1.5),autoDensity:true});app.ticker.maxFPS=30
  model=await SDK.Live2DModel.from(new URL('./vendor/hiyori_free_zh/runtime/hiyori_free_t08.model3.json',location.href).href,{autoInteract:false});if(disposed){model.destroy();return}app.stage.addChild(model);fit();observer=new ResizeObserver(fit);observer.observe(host.value)
  const internal=model.internalModel,core=internal.coreModel;
  internal.motionManager.stopAllMotions();originalUpdate=internal.motionManager.update;internal.motionManager.update=()=>true
  originalNatural=internal.updateNaturalMovements;originalPhysics=internal.physics;originalPose=internal.pose;internal.pose=null
  const ids=Array.from(core._model.parameters.ids),rig=ids.map((id,index)=>({id,index,min:core.getParameterMinimumValue(index),max:core.getParameterMaximumValue(index),neutral:core.getParameterDefaultValue(index),group:groupFor(id)}));
  const parts=Array.from(core._model.parts.ids).map((id,index)=>({id,index,opacity:core.getPartOpacityByIndex(index)}));
  const known=new Map(rig.map(r=>[r.id,r]));loadMotion();emit('ready',rig)
  internal.updateNaturalMovements=function(){
   for(const r of rig)core.setParameterValueByIndex(r.index,r.neutral)
   for(const p of parts)core.setPartOpacityByIndex(p.index,p.opacity)
   nativeMotion?.doUpdateParameters(core,props.time,1,entry)
   let parity=0;const raw={};
   for(const c of props.motion?.curves||[]){const r=known.get(c.id);if(c.target!=='Parameter'||!r)continue;raw[c.id]=core.getParameterValueByIndex(r.index);const expected=Math.max(r.min,Math.min(r.max,sampleCurve(c,props.time)));parity=Math.max(parity,Math.abs(expected-raw[c.id]))}
   for(const r of rig)if(!props.layers[r.group])core.setParameterValueByIndex(r.index,r.neutral)
   for(const p of parts)if(!props.layers[groupFor(p.id)])core.setPartOpacityByIndex(p.index,p.opacity)
   if(performance.now()-lastReport>70){lastReport=performance.now();emit('frame',{raw,parity})}
  }
  internal.physics={evaluate:(target,dt)=>{if(props.physics&&props.playing)originalPhysics?.evaluate(target,dt*props.speed)}}
  internal.on('beforeModelUpdate',()=>{
   const actual=Object.fromEntries(rig.map(r=>[r.id,core.getParameterValueByIndex(r.index)]));emit('frame',{actual})
  })
 }catch(error){emit('error',error.message)}
})
watch(()=>props.source,loadMotion)
watch(()=>props.framing,fit)
onBeforeUnmount(()=>{disposed=true;observer?.disconnect();if(model){const m=model.internalModel;m.motionManager.update=originalUpdate;m.updateNaturalMovements=originalNatural;m.physics=originalPhysics;m.pose=originalPose}app?.destroy(true,{children:true,texture:true,baseTexture:true})})
</script>
<template><div ref="host" class="study-character"><canvas ref="canvas" :aria-label="label"/></div></template>
