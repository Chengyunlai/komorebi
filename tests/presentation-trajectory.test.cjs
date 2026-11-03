const {test}=require('node:test');const assert=require('node:assert/strict');const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('offline centered inclusive windows preserve constant and interior uniform speed',async()=>{
 const {buildPresentationOffsets}=await import('../src/motion/presentation-trajectory.mjs');assert.deepEqual(buildPresentationOffsets(Array.from({length:8},()=>[4,8,2]),{fps:2}),Array.from({length:8},()=>[0,0,0]));
 const offsets=buildPresentationOffsets(Array.from({length:10},(_,i)=>[i,100-i,2*i]),{fps:2,windowSeconds:2});assert.deepEqual(offsets[0],[0,0,0]);assert.deepEqual(offsets[1],[.5,0,1]);assert.deepEqual(offsets[2],[1,0,2]);
 for(let i=3;i<8;i++){near(offsets[i][0]-offsets[i-1][0],1);near(offsets[i][2]-offsets[i-1][2],2)}
 assert.deepEqual(buildPresentationOffsets([[1,2,3]],{fps:15}),[[0,0,0]]);
});
test('trajectory depends only on source hips, ignores vertical oscillation and preserves input',async()=>{
 const {buildPresentationOffsets}=await import('../src/motion/presentation-trajectory.mjs');const points=Array.from({length:12},(_,i)=>[i*.2,Math.sin(i)*99,i*.3]),snapshot=structuredClone(points);const output=buildPresentationOffsets(points,{fps:3});assert.deepEqual(points,snapshot);assert.deepEqual(output,buildPresentationOffsets(points.map(([x,,z])=>[x,0,z]),{fps:3}));
});
test('world translation preserves relative root and feet under scaled rotated parent',async()=>{
 const {Matrix4,Quaternion,Vector3}=await import('three');const {translateMotionPose}=await import('../src/motion/presentation-trajectory.mjs');
 const parent=new Matrix4().compose(new Vector3(4,2,-3),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.8),new Vector3(2,2,2));const space={hipsParentWorldMatrix:parent.toArray(),hipsRest:[0,1,0]},pose={hips:[.1,.2,.3],rotations:{hips:[0,0,0,1]},feet:{left:[2,0,1],right:[3,0,2]}},snapshot=structuredClone(pose),shift=[.5,0,-.7];const result=translateMotionPose(pose,shift,space);
 const world=p=>new Vector3().fromArray(p.hips).add(new Vector3().fromArray(space.hipsRest)).applyMatrix4(parent);const before=world(pose),after=world(result);near(after.clone().sub(before).distanceTo(new Vector3().fromArray(shift)),0);
 for(const side of ['left','right'])near(new Vector3().fromArray(result.feet[side]).sub(after).distanceTo(new Vector3().fromArray(pose.feet[side]).sub(before)),0);
 assert.deepEqual(result.rotations,pose.rotations);assert.deepEqual(pose,snapshot);result.rotations.hips[0]=5;assert.deepEqual(pose,snapshot);
 assert.equal(translateMotionPose({hips:[0,0,0],rotations:{}},[1,0,0]).feet,undefined);
});
test('rejects invalid points, timing and pose spaces',async()=>{
 const {buildPresentationOffsets,translateMotionPose}=await import('../src/motion/presentation-trajectory.mjs');for(const points of [[],null,[[0,NaN,0]],[[0,1]]])assert.throws(()=>buildPresentationOffsets(points,{fps:15}));for(const options of [{fps:0},{fps:Infinity},{fps:15,windowSeconds:-1},{fps:15,windowSeconds:NaN}])assert.throws(()=>buildPresentationOffsets([[0,0,0]],options));
 const pose={hips:[0,0,0],rotations:{}};assert.throws(()=>translateMotionPose(pose,[0,Infinity,0]));assert.throws(()=>translateMotionPose(pose,[0,0,0],{hipsParentWorldMatrix:Array(16).fill(0)}));assert.throws(()=>translateMotionPose(pose,[0,0,0],{hipsRest:[0,0]}));
});
