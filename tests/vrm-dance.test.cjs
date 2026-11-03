const {test}=require('node:test');const assert=require('node:assert/strict');
test('VRM music input moves elbows and knees and silence releases to relaxed pose',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController();let pose,peakKnee=0,peakArm=0;
 for(let frame=0;frame<90;frame++){const onset=Math.floor(frame/15)*24000;pose=d.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId:'test',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:onset,state:'active',energy:.8,bands:{low:.8,mid:.3,high:.2}},enabled:true});peakKnee=Math.max(peakKnee,pose.rotations.leftLowerLeg[0]);peakArm=Math.max(peakArm,Math.abs(pose.rotations.leftUpperArm[2]+1.25))}
 assert.ok(peakKnee>.1);assert.ok(peakArm>.3);assert.ok(Math.abs(pose.rotations.leftLowerArm[1])>.15||Math.abs(pose.rotations.rightLowerArm[1])>.15);
 for(let i=0;i<180;i++)pose=d.step({dt:1/30,audioMode:true,signalAge:2,enabled:true});assert.ok(pose.rotations.leftLowerLeg[0]<.001);assert.ok(Math.abs(pose.rotations.leftUpperArm[2]+1.18)<.001);
});
test('disabled dance and waiting input never invent music-driven movement',async()=>{const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController();for(let i=0;i<120;i++){const p=d.step({dt:1/30,audioMode:true,enabled:false,signalAge:0,signal:{sampleRate:48000,sampleFrame:i*1600,lastOnsetFrame:i*1600,state:'active',energy:1,streamId:'off'}});assert.equal(p.rotations.leftLowerLeg[0],0);assert.ok(Math.abs(p.rotations.leftUpperArm[2]+1.18)<1e-9)}const waiting=d.step({dt:1/30,audioMode:true});assert.equal(waiting.source.mode,'waiting')});
test('historical clips retain mirrored arcs; runtime phrase is not restarted by dense onsets',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const {sampleClip}=await import('../src/motion/vrm-clips.mjs');
 const reach=sampleClip('diagonal-reach',.48),mirror=sampleClip('diagonal-reach',.48,-1);assert.ok(reach.leftReach>.8);assert.ok(Math.abs(reach.twist)>.3);assert.ok(reach.stepR>.4);assert.equal(reach.leftReach,mirror.rightReach);assert.equal(reach.twist,-mirror.twist);assert.equal(sampleClip('diagonal-reach',1).leftReach,0);
 const d=new VRMDanceController();let pose;const names=new Set();let maxLift=0;for(let frame=0;frame<240;frame++){pose=d.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId:'dense',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:Math.floor(frame/3)*4800,state:'active',energy:.9,bands:{low:.9,mid:.2,high:.1}}});names.add(pose.source.primitive);maxLift=Math.max(maxLift,pose.feet.left[1],pose.feet.right[1])}assert.ok(pose.source.eventCount>pose.source.clipCount*3);assert.ok(pose.source.clipCount>=1&&pose.source.clipCount<=3);assert.ok(names.has('phrase-A'));assert.ok(maxLift>.07);
});
test('analytic support-leg IK holds ankle position while pelvis shifts and lowers',async()=>{
 const {Object3D,Vector3}=await import('three');const {solveLeg}=await import('../src/motion/foot-ik.mjs');const root=new Object3D(),upper=new Object3D(),lower=new Object3D(),foot=new Object3D();root.add(upper);upper.add(lower);lower.add(foot);upper.position.y=1;lower.position.y=-.5;foot.position.y=-.5;root.updateMatrixWorld(true);const target=new Vector3(0,0,0);
 for(const shift of [-.1,0,.1]){upper.quaternion.identity();lower.quaternion.identity();upper.position.set(shift,.88,0);root.updateMatrixWorld(true);const result=solveLeg(upper,lower,foot,target);assert.ok(result.error<1e-6);assert.ok(lower.getWorldPosition(new Vector3()).z>0);assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(target)<1e-6)}
});
test('short gaps between drums let a clip finish; explicit silence stops it',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController(),signal={streamId:'gaps',sampleRate:48000,sampleFrame:0,lastOnsetFrame:0,state:'active',energy:.8,bands:{low:1}};
 d.step({dt:1/30,audioMode:true,signalAge:0,signal});let p;for(let i=1;i<12;i++)p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:{...signal,sampleFrame:i*1600,energy:0}});assert.equal(p.source.clipCount,1);assert.equal(p.source.primitive,'phrase-A');assert.ok(p.feet.left[0]>.02);
 p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:{...signal,sampleFrame:20000,state:'silent',energy:0}});assert.equal(p.source.primitive,'rest');
});
test('side-step IK lowers pelvis enough for both foot targets to remain reachable',async()=>{
 const {Object3D,Vector3}=await import('three');const {createFootPlant}=await import('../src/motion/foot-ik.mjs');const scene=new Object3D(),hips=new Object3D(),bones={hips};scene.add(hips);hips.position.y=.8;
 for(const [side,x] of [['left',.08],['right',-.08]]){let parent=hips;for(const [suffix,position] of [['UpperLeg',[x,0,0]],['LowerLeg',[0,-.4,0]],['Foot',[0,-.4,0]]]){const node=bones[side+suffix]=new Object3D();node.position.fromArray(position);parent.add(node);parent=node}}
 const plant=createFootPlant({scene,humanoid:{getNormalizedBoneNode:name=>bones[name]}});hips.position.x=.065;scene.updateMatrixWorld(true);const error=plant.apply({left:[.18,0,0],right:[0,0,0]});assert.ok(hips.position.y<.8);assert.ok(error<1e-6);assert.ok(Math.abs(bones.leftFoot.getWorldPosition(new Vector3()).y)<1e-6);
});
