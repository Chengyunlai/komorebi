const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Quaternion}=require('three');
const q=angle=>new Quaternion().setFromAxisAngle({x:1,y:0,z:0},angle).toArray();
const fixture=angle=>({rotations:Object.fromEntries(['hips','leftUpperLeg','rightLowerLeg','leftFoot','rightToes','leftUpperArm'].map(n=>[n,q(angle)])),hips:[angle,angle/2,0],feet:{left:[angle,0,0],right:[0,angle,0]}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('legacy exactly preserves independent quaternion and root caps, with unchanged feet',async()=>{
 const {limitMotionPose}=await import('../src/motion/pose-limiter.mjs');const previous=fixture(0),desired=fixture(1),expected=structuredClone(desired);
 for(const n of Object.keys(expected.rotations)){const a=new Quaternion().fromArray(previous.rotations[n]),b=new Quaternion().fromArray(desired.rotations[n]),angle=a.angleTo(b);expected.rotations[n]=a.slerp(b,angle?Math.min(1,.1*7/angle):1).toArray()}
 expected.hips=desired.hips.map((v,i)=>previous.hips[i]+Math.max(-.1*.4,Math.min(.1*.4,v-previous.hips[i])));
 assert.deepEqual(limitMotionPose(previous,desired,{dt:.1,angularSpeed:7,rootSpeed:.4}).pose,expected);
});
test('coherent lower body, root and feet share factor; upper arm remains independent',async()=>{
 const {limitMotionPose}=await import('../src/motion/pose-limiter.mjs');const previous=fixture(0),desired=fixture(1);desired.rotations.leftUpperArm=q(2);
 const {pose,metrics}=limitMotionPose(previous,desired,{dt:.1,angularSpeed:1,rootSpeed:.5,mode:'coherent-lower-body'});near(metrics.factor,.05);
 for(const n of Object.keys(pose.rotations).filter(n=>n!=='leftUpperArm'))near(new Quaternion().fromArray(pose.rotations[n]).angleTo(new Quaternion()),.05);
 near(new Quaternion().fromArray(pose.rotations.leftUpperArm).angleTo(new Quaternion()),.1);
 near(pose.hips[0],.05);near(pose.hips[1],.025);near(pose.feet.left[0],.05);near(pose.feet.right[1],.05);near(metrics.feetTargetShift,.95);
});
test('invalid dt freezes limited channels and inputs remain untouched',async()=>{
 const {limitMotionPose}=await import('../src/motion/pose-limiter.mjs');const previous=fixture(0),desired=fixture(1),snapshot=structuredClone({previous,desired});
 for(const dt of [NaN,Infinity,-1]){const {pose}=limitMotionPose(previous,desired,{dt,angularSpeed:9,rootSpeed:1,mode:'coherent-lower-body'});assert.deepEqual(pose,previous)}
 assert.deepEqual({previous,desired},snapshot);const first=limitMotionPose(null,desired,{mode:'legacy'}).pose;first.feet.left[0]=99;assert.deepEqual(desired,snapshot.desired);
});
test('optional feet stay optional',async()=>{
 const {limitMotionPose}=await import('../src/motion/pose-limiter.mjs');const a=fixture(0),b=fixture(1);delete a.feet;delete b.feet;
 const result=limitMotionPose(a,b,{dt:.1,angularSpeed:1,rootSpeed:1,mode:'coherent-lower-body'});assert.equal(result.pose.feet,undefined);assert.equal(result.metrics.feetTargetShift,0);
});
test('players expose isolated pose stages only when requested',async()=>{
 const {MotionBankPlayer}=await import('../src/motion/motion-bank.mjs');const {BeatStepPlayer}=await import('../src/motion/beat-steps.mjs');
 const frames=[fixture(0),fixture(1),fixture(.5)],names=Object.keys(frames[0].rotations);
 const bank={frames,names,fps:1,clips:[{start:0,end:2,beats:2,anchors:[{frame:0,beat:0},{frame:1,beat:1},{frame:2,beat:2}]}],footHeights:frames.map(()=>({left:0,right:0})),contact:{frames:frames.map(()=>({support:'left'}))},transitions:[[{allowed:true,cost:0}]]};
 for(const Player of [MotionBankPlayer,BeatStepPlayer]){
  const plain=new Player(bank);plain.step({dt:.1,active:true,beat:0});assert.equal(plain.lastStages,undefined);
  const traced=new Player(bank,{traceStages:true,limiterMode:'coherent-lower-body'});traced.step({dt:.1,active:true,beat:0});const result=traced.step({dt:.1,active:true,beat:.5});
  assert.deepEqual(Object.keys(traced.lastStages),['sample','blended','limited']);assert.equal(result.limiter.mode,'coherent-lower-body');assert.equal(traced.lastStages.limited.weight,undefined);
  const original=traced.lastStages.sample.hips[0];result.hips[0]=99;traced.output.hips[0]=88;assert.equal(traced.lastStages.sample.hips[0],original);assert.notEqual(traced.lastStages.limited.hips[0],88);
 }
});
test('planned lower body retains desired root, feet and leg poses while capping arms',async()=>{
 const {limitMotionPose}=await import('../src/motion/pose-limiter.mjs');const previous=fixture(0),desired=fixture(1),snapshot=structuredClone({previous,desired});
 const {pose,metrics}=limitMotionPose(previous,desired,{dt:.1,angularSpeed:1,rootSpeed:.01,mode:'planned-lower-body'});
 for(const name of Object.keys(desired.rotations).filter(n=>n!=='leftUpperArm'))assert.deepEqual(pose.rotations[name],desired.rotations[name]);
 near(new Quaternion().fromArray(pose.rotations.leftUpperArm).angleTo(new Quaternion()),.1);assert.deepEqual(pose.hips,desired.hips);assert.deepEqual(pose.feet,desired.feet);assert.equal(metrics.factor,1);assert.equal(metrics.feetTargetShift,0);
 assert.deepEqual({previous,desired},snapshot);pose.feet.left[0]=99;assert.deepEqual(desired,snapshot.desired);
});
