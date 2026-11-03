const {test}=require('node:test');const assert=require('node:assert/strict');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('world yaw consistently transforms root and feet under a rotated parent',async()=>{
 const {Quaternion,Vector3,Matrix4}=await import('three');const {yawMotionPose,motionPoseHeading}=await import('../src/motion/pose-space.mjs');
 const parent=new Matrix4().makeRotationY(.7);parent.setPosition(3,2,1);const def={hipsParentWorldMatrix:parent.toArray(),hipsRest:[0,1,0]};
 const pose={rotations:{hips:[0,0,0,1],leftUpperLeg:[0,0,0,1]},hips:[.2,.1,.3],feet:{left:[3.2,0,1.3],right:[2.8,0,1]}};const snapshot=structuredClone(pose),out=yawMotionPose(pose,.9,def);
 near(motionPoseHeading(out,def)-motionPoseHeading(pose,def),.9);
 const pivot=new Vector3(0,1,0).applyMatrix4(parent),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.9);
 const expected=new Vector3().fromArray(pose.hips).add(new Vector3(0,1,0)).applyMatrix4(parent).sub(pivot).applyQuaternion(rotation).add(pivot);
 const actual=new Vector3().fromArray(out.hips).add(new Vector3(0,1,0)).applyMatrix4(parent);near(actual.distanceTo(expected),0);
 near(new Vector3().fromArray(out.feet.left).distanceTo(new Vector3().fromArray(pose.feet.left).sub(pivot).applyQuaternion(rotation).add(pivot)),0);
 assert.deepEqual(out.rotations.leftUpperLeg,pose.rotations.leftUpperLeg);assert.deepEqual(pose,snapshot);
});
function makeBank(){
 const frames=Array.from({length:31},(_,i)=>({rotations:{hips:[0,Math.sin(i*.025),0,Math.cos(i*.025)],leftUpperLeg:[0,0,0,1]},hips:[i*.01,0,0],feet:{left:[i*.01,0,.1],right:[i*.01,0,-.1]}}));
 const clips=[{start:0,end:10,beats:2,anchors:[{frame:0,beat:0},{frame:5,beat:1},{frame:10,beat:2}]},{start:20,end:30,beats:2,anchors:[{frame:20,beat:0},{frame:25,beat:1},{frame:30,beat:2}]}];
 return {frames,clips,names:Object.keys(frames[0].rotations),footHeights:frames.map(()=>({left:0,right:0})),contact:{frames:frames.map(()=>({support:'left'}))},transitions:clips.map(()=>clips.map(()=>({allowed:true,cost:0})))};
}
test('preroll advances to exact incoming boundary then retains aligned yaw',async()=>{
 const {BeatStepPlayer}=await import('../src/motion/beat-steps.mjs');const {yawMotionPose}=await import('../src/motion/pose-space.mjs');const player=new BeatStepPlayer(makeBank(),{transitionPolicy:'heading-preroll',limiterMode:'planned-lower-body',traceStages:true});
 player.step({dt:.1,active:true,beat:0});player.step({dt:.1,active:true,beat:1.7});player.step({dt:.1,active:true,beat:1.85});const yaw=player.plannedYaw;assert.ok(Number.isFinite(yaw));
 const before=player.step({dt:.1,active:true,beat:1.999999});const boundary=player.step({dt:.1,active:true,beat:2});assert.equal(boundary.clip,1);assert.equal(boundary.sourceFrame,20);assert.equal(player.clipYaw,yaw);
 const expected=yawMotionPose(player.sample(20),yaw);assert.deepEqual(boundary.feet,expected.feet);assert.ok(Math.hypot(...boundary.feet.left.map((v,i)=>v-before.feet.left[i]))<1e-6);
 player.step({dt:.1,active:true,beat:2.1});assert.equal(player.clipYaw,yaw);assert.equal(boundary.transitionPolicy,'heading-preroll');
});
test('source-zero preroll clamps safely and invalid transition policy is rejected',async()=>{
 const {BeatStepPlayer}=await import('../src/motion/beat-steps.mjs');const bank=makeBank();assert.throws(()=>new BeatStepPlayer(bank,{transitionPolicy:'bad'}));const player=new BeatStepPlayer(bank,{transitionPolicy:'heading-preroll',limiterMode:'planned-lower-body'});player.clip=1;
 player.step({dt:.1,active:true,beat:0});const result=player.step({dt:.1,active:true,beat:1.9});assert.ok(result.feet.left.every(Number.isFinite));assert.equal(player.plannedNext,0);
});
test('transition duration validates clip bounds and uses corrected preceding opposite landing',async()=>{
 const {BeatStepPlayer}=await import('../src/motion/beat-steps.mjs');const bank=makeBank();bank.fps=10;bank.clips.forEach(c=>c.support='left');bank.motionLandings=[{frame:12,side:'right'},{frame:18,side:'left'}];
 const defaults=new BeatStepPlayer(bank);assert.equal(defaults.transitionBeats,.3);
 for(const transitionBeats of [0,-1,NaN,1.01])assert.throws(()=>new BeatStepPlayer(bank,{transitionBeats}));
 const player=new BeatStepPlayer(bank,{transitionPolicy:'heading-preroll',transitionBeats:1,limiterMode:'planned-lower-body'});const samples=[];const original=player.sample.bind(player);player.sample=frame=>{samples.push(frame);return original(frame)};
 player.step({dt:.1,active:true,beat:0});samples.length=0;
 const output=player.step({dt:.1,active:true,beat:1.5});assert.equal(output.incomingPrerollMethod,'preceding-opposite-landing');assert.ok(samples.includes(12));assert.ok(samples.includes(16));
 bank.motionLandings=[{frame:19,side:'right'}];player.step({dt:.1,active:true,beat:1.6});assert.equal(player.incomingPrerollMethod,'first-anchor-interval');
});
