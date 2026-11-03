import {VRMDanceController} from '../../../src/motion/vrm-dance.mjs';
import {PHRASE_THEMES} from '../../../src/motion/vrm-phrases.mjs';
const controller=new VRMDanceController();let last=-1;
for(let frame=0;frame<3600;frame++){const result=controller.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId:'theme-example',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:Math.floor(frame/15)*24000,state:'tracking',energy:.8,bands:{low:.8,mid:.1,high:.1},tempo:{bpm:120,confidence:.7}}});if(result.source.variation!==last){last=result.source.variation;console.log(JSON.stringify({beat:result.source.beat,theme:PHRASE_THEMES[last].label,support:result.source.support}))}}
