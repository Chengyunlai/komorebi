import {readFile} from 'node:fs/promises';
import {VRMIdleController} from '../../../src/motion/vrm-idle.mjs';
const source=JSON.parse(await readFile(new URL('../../../public/vendor/hiyori_free_zh/runtime/motion/hiyori_m05.motion3.json',import.meta.url)));
const idle=new VRMIdleController(source);
for(const time of [0,2,4,6,idle.period]){const pose=idle.sample(time);console.log(JSON.stringify({time,head:pose.rotations.head,body:pose.rotations.spine,hips:pose.hips,blink:pose.expressions.blinkLeft}))}
