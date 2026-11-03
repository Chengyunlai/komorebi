const {test}=require('node:test'),assert=require('node:assert/strict');
const setup=async()=>{
 const [{createRotationFixture},{createVRMRetarget},{createVRMRotationRetarget},{skeletonAt},{capturePoseRecord,comparePoseRecords}]=await Promise.all([import('../examples/stage-15-rotation-retarget/core/rotation-body.mjs'),import('../src/motion-lab/vrm-retarget.mjs'),import('../src/motion-lab/rotation-retarget.mjs'),import('../src/motion-lab/bvh.mjs'),import('../src/motion/motion-record.mjs')]);
 return {createRotationFixture,createVRMRetarget,createVRMRotationRetarget,skeletonAt,capturePoseRecord,comparePoseRecords};
};
test('sampled direction and rotation match exact BVH frames with original calibration',async()=>{
 const api=await setup();
 for(const factory of [api.createVRMRetarget,api.createVRMRotationRetarget])for(const rootMode of ['height','source','balance']){
  const a=api.createRotationFixture(1.3,.4),b=api.createRotationFixture(1.3,.4),ra=factory(a.vrm,a.bvh,{rootMode}),rb=factory(b.vrm,b.bvh,{rootMode});
  for(const f of [0,17,79]){
   const time=f*a.bvh.frameTime,frame=api.skeletonAt(a.bvh,time);
   assert.deepEqual(ra.apply(time),rb.applyFrame(frame));
   assert.deepEqual(api.capturePoseRecord(a.vrm),api.capturePoseRecord(b.vrm));
   if(ra.measure)assert.deepEqual(ra.measure(time),rb.measureFrame(frame));
  }
 }
});
test('sampled source rotation changes target between original source frames',async()=>{
 const api=await setup(),{Quaternion,Matrix4}=await import('three'),body=api.createRotationFixture(),r=api.createVRMRotationRetarget(body.vrm,body.bvh),frame=api.skeletonAt(body.bvh,0),index=body.bvh.joints.findIndex(j=>j.name==='Hand_L');
 r.applyFrame(frame);const before=body.nodes.leftHand.quaternion.clone();
 const intermediate=structuredClone(frame),matrix=new Matrix4().fromArray(intermediate.matrices[index]).transpose(),q=new Quaternion().setFromAxisAngle({x:1,y:0,z:0},.37);
 matrix.multiply(new Matrix4().makeRotationFromQuaternion(q));intermediate.matrices[index]=matrix.transpose().toArray();intermediate.frame=.5;
 const report=r.applyFrame(intermediate);
 assert.ok(before.angleTo(body.nodes.leftHand.quaternion)>.36);assert.ok(report.rotationResidual.maxRadians<1e-6);assert.equal(report.frame,.5);
 assert.deepEqual(r.measureFrame(intermediate),report.rotationResidual);
});
test('invalid sampled positions and matrices fail before target pose or frame state changes',async()=>{
 const api=await setup();
 for(const factory of [api.createVRMRetarget,api.createVRMRotationRetarget]){
  const body=api.createRotationFixture(),r=factory(body.vrm,body.bvh),frame=api.skeletonAt(body.bvh,body.bvh.frameTime*17);
  r.applyFrame(frame);const before=api.capturePoseRecord(body.vrm);
  for(const alter of [f=>f.positions[0][0]=NaN,f=>f.positions.pop(),f=>f.matrices[0][0]=Infinity,f=>f.matrices.pop(),f=>f.frame=NaN]){
   const invalid=structuredClone(frame);alter(invalid);assert.throws(()=>r.applyFrame(invalid),/Invalid sampled skeleton/);assert.deepEqual(api.capturePoseRecord(body.vrm),before);
   if(r.measureFrame){assert.throws(()=>r.measureFrame(invalid),/Invalid sampled skeleton/);assert.deepEqual(api.capturePoseRecord(body.vrm),before)}
  }
  assert.equal(r.applyFrame(frame).changed,false);
  const positionsOnly={positions:frame.positions,frame:frame.frame};
  if(r.measureFrame)assert.throws(()=>r.applyFrame(positionsOnly),/matrices/);else assert.doesNotThrow(()=>r.applyFrame(positionsOnly));
 }
});
