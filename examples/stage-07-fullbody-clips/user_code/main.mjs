import {VRMDanceController} from '../../../src/motion/vrm-dance.mjs';
const controller=new VRMDanceController(),clips=new Set();let lifted=0,result;
for(let frame=0;frame<300;frame++){result=controller.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId:'original-contract-example',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:Math.floor(frame/8)*12800,state:'active',energy:.8,bands:{low:.8,mid:.3,high:.2}},enabled:true});clips.add(result.source.primitive);lifted=Math.max(lifted,result.feet.left[1],result.feet.right[1])}
console.log(JSON.stringify({clips:[...clips],onsets:result.source.eventCount,completedOrStartedClips:result.source.clipCount,maxFootLiftFraction:lifted}));
