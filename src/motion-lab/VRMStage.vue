<script setup>
import {ref,onMounted,onBeforeUnmount,watch} from 'vue'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm'
import {createVRMRetarget} from './vrm-retarget.mjs'
const props=defineProps({bvh:Object,time:Number,physics:Boolean});const emit=defineEmits(['ready','error','frame']);const host=ref(null),status=ref('正在读取本机角色…'),yaw=ref(0)
let renderer,scene,camera,vrm,adapter,observer,disposed=false,lastTime=null,blobUrl,lastReport=-1
function resize(){if(!renderer)return;const {width,height}=host.value.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);const aspect=width/height;camera.left=-1.25*aspect;camera.right=1.25*aspect;camera.top=1.15;camera.bottom=-1.15;camera.updateProjectionMatrix();draw()}
function rebuild(){if(vrm&&props.bvh){adapter=createVRMRetarget(vrm,props.bvh);emit('ready',{title:vrm.meta?.name||'Cute Model',bones:adapter.mappedBones.length});draw()}}
function draw(){if(!vrm||!renderer||disposed)return;try{
 const report=adapter?.apply(props.time||0),delta=lastTime===null?0:(props.time-lastTime);if(delta<0||delta>.15)vrm.springBoneManager?.reset();
 vrm.update(props.physics&&delta>0&&delta<.15?delta:0);lastTime=props.time;
 if(report){vrm.scene.updateMatrixWorld(true);report.maxDirectionError=0;const ends={leftUpperArm:'leftLowerArm',leftLowerArm:'leftHand',rightUpperArm:'rightLowerArm',rightLowerArm:'rightHand',leftUpperLeg:'leftLowerLeg',leftLowerLeg:'leftFoot',rightUpperLeg:'rightLowerLeg',rightLowerLeg:'rightFoot'};for(const [name,end] of Object.entries(ends)){const a=vrm.humanoid.getRawBoneNode(name),b=vrm.humanoid.getRawBoneNode(end);const actual=b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3())).normalize();report.maxDirectionError=Math.max(report.maxDirectionError,actual.angleTo(new THREE.Vector3(...report.directions[name]))*180/Math.PI)}}
 const angle=yaw.value*Math.PI/180;camera.position.set(Math.sin(angle)*4,1,Math.cos(angle)*4);camera.lookAt(0,1,0);renderer.render(scene,camera);
 if(report&&Math.abs(props.time-lastReport)>.7){lastReport=props.time;emit('frame',report)}
 }catch(e){emit('error',e.message)}}
onMounted(async()=>{try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(devicePixelRatio);renderer.outputColorSpace=THREE.SRGBColorSpace;host.value.append(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1.15,-1.15,.1,30);scene.add(new THREE.HemisphereLight(0xffffff,0xabb5c5,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(1,3,3);scene.add(light);
 const grid=new THREE.GridHelper(4,16,0xcbd4dd,0xe0e6ed);scene.add(grid);
 const resource=await window.komorebi.motionAvatar();if(!resource)throw Error('本机未找到 Cute_Model.vrm，请放入应用数据目录 local-models。');if(disposed)return;
 const bytes=resource.bytes;blobUrl=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.loadAsync(blobUrl);URL.revokeObjectURL(blobUrl);blobUrl=null;
 vrm=gltf.userData.vrm;if(disposed){VRMUtils.deepDispose(vrm.scene);return}VRMUtils.rotateVRM0(vrm);scene.add(vrm.scene);vrm.scene.updateMatrixWorld(true);status.value='';rebuild();observer=new ResizeObserver(resize);observer.observe(host.value);resize();
 }catch(e){status.value=e.message;emit('error',e.message)}})
watch(()=>props.bvh,rebuild);watch(()=>[props.time,props.physics,yaw.value],draw)
onBeforeUnmount(()=>{disposed=true;observer?.disconnect();if(blobUrl)URL.revokeObjectURL(blobUrl);if(scene)VRMUtils.deepDispose(scene);renderer?.dispose();renderer?.domElement.remove()})
</script>
<template><div class="vrm-stage"><div ref="host" class="vrm-canvas" aria-label="蓝发少女 VRM 全身舞蹈预览"/><p v-if="status" role="status">{{status}}</p><label>观察角度 <input v-model.number="yaw" type="range" min="-180" max="180" aria-label="VRM观察角度"/></label></div></template>
