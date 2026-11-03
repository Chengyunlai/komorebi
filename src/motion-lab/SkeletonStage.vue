<script setup>
import {ref,computed,onMounted,onBeforeUnmount,watch} from 'vue'
import {skeletonAt,anatomicalEdges} from './bvh.mjs'
const props=defineProps({bvh:Object,time:Number});const canvas=ref(null);const yaw=ref(20),follow=ref(true);let observer
const scene=computed(()=>{
 if(!props.bvh)return null
 const bvh=props.bvh,hips=bvh.joints.findIndex(j=>j.name==='Hips');let minY=Infinity,maxY=-Infinity,radius=0
 for(let frame=0;frame<bvh.frameCount;frame+=15){const {positions}=skeletonAt(bvh,frame*bvh.frameTime),center=positions[Math.max(0,hips)];positions.forEach((p,i)=>{if(bvh.joints[i].name==='joint_Root')return;minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);radius=Math.max(radius,Math.hypot(p[0]-center[0],p[2]-center[2]))})}
 return {floor:minY,height:maxY-minY||180,radius:radius||90}
})
function draw(){
 const el=canvas.value;if(!el||!props.bvh)return;const rect=el.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);el.width=rect.width*dpr;el.height=rect.height*dpr;const ctx=el.getContext('2d');ctx.scale(dpr,dpr)
 const {positions}=skeletonAt(props.bvh,props.time),a=yaw.value*Math.PI/180,hips=props.bvh.joints.findIndex(j=>j.name==='Hips'),root=positions[Math.max(0,hips)],floor=scene.value.floor;
 const scale=Math.min(rect.width/(scene.value.radius*2.3),rect.height/(scene.value.height*1.2));
 const project=p=>{const x=p[0]-(follow.value?root[0]:0),z=p[2]-(follow.value?root[2]:0);return [rect.width/2+(x*Math.cos(a)+z*Math.sin(a))*scale,rect.height*.90-(p[1]-floor)*scale]}
 ctx.strokeStyle='#dce4e9';ctx.lineWidth=1;for(let i=-4;i<=4;i++){ctx.beginPath();ctx.moveTo(20,rect.height*.90+i*9);ctx.lineTo(rect.width-20,rect.height*.90+i*9);ctx.stroke()}
 anatomicalEdges(props.bvh).forEach(edge=>{const j=props.bvh.joints[edge.to],colorName=j.name==='End Site'?props.bvh.joints[edge.from].name:j.name,p=project(positions[edge.to]),parent=project(positions[edge.from]);ctx.strokeStyle=/Arm|Shoulder|Hand/.test(colorName)?'#c97642':/Leg|Foot|Toe/.test(colorName)?'#5478b4':'#507e69';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...parent);ctx.lineTo(...p);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(...p,3,0,Math.PI*2);ctx.fill()})
}
onMounted(()=>{observer=new ResizeObserver(draw);observer.observe(canvas.value);draw()});watch(()=>[props.time,props.bvh,yaw.value,follow.value],draw);onBeforeUnmount(()=>observer?.disconnect())
</script>
<template><div class="skeleton-stage"><canvas ref="canvas" aria-label="完整舞蹈骨架预览"/><label>观察角度 <input v-model.number="yaw" type="range" min="-180" max="180" aria-label="骨架观察角度"/></label><label><input v-model="follow" type="checkbox"/>镜头跟随髋部位置</label></div></template>
