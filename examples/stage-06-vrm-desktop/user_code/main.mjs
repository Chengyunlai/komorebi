import {VRMDanceController} from '../../../src/motion/vrm-dance.mjs';
const controller=new VRMDanceController();let output;
// Synthetic signal contract only; the production analyzer lives in music-signal-lab.
for(let frame=0;frame<60;frame++)output=controller.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId:'example',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:Math.floor(frame/15)*24000,state:'active',energy:.8,bands:{low:.8,mid:.3,high:.2}},enabled:true});
console.log(JSON.stringify({mode:output.source.mode,events:output.source.eventCount,elbows:[output.rotations.leftLowerArm,output.rotations.rightLowerArm],knees:[output.rotations.leftLowerLeg,output.rotations.rightLowerLeg]}));
for(let i=0;i<180;i++)output=controller.step({dt:1/30,audioMode:true,signalAge:2});
console.log('断流收势',JSON.stringify(output.rotations.leftLowerLeg));
