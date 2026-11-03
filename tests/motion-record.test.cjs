const {test}=require('node:test'),assert=require('node:assert/strict')
async function fixture(scale=1,optional=true) {
 const {Object3D,Euler}=await import('three'),scene=new Object3D(),hips=new Object3D(),spine=new Object3D(),head=new Object3D()
 scene.add(hips);hips.add(spine);spine.add(head);hips.position.set(.1,scale,0);spine.position.set(0,.3*scale,0);head.position.set(0,.2*scale,0);spine.quaternion.setFromEuler(new Euler(.2,.1,-.3))
 const nodes={hips,spine,head};if(optional){const chest=new Object3D();spine.add(chest);chest.position.y=.1*scale;nodes.chest=chest}
 const normalizedRestPose=Object.fromEntries(Object.entries(nodes).map(([name,node])=>[name,{position:node.position.toArray(),rotation:node.quaternion.toArray()}]))
 return {scene,humanoid:{normalizedRestPose,getNormalizedBoneNode:name=>nodes[name]??null,getNormalizedPose(){throw Error('Relative pose must not be read')}},nodes}
}
test('body profiles preserve two proportions, nonidentity rest and missing optional bones',async()=>{
 const {createBodyProfile}=await import('../src/motion/motion-record.mjs'),a=await fixture(1),b=await fixture(2,false),pa=createBodyProfile(a),pb=createBodyProfile(b,{id:'tall'})
 assert.equal(pa.schema,'body-profile/v1');assert.equal(pb.bodyId,'tall');assert.deepEqual(pa.coordinate,{unit:'metre',space:'normalized-local-absolute',quaternion:'xyzw'})
 assert.equal(pa.bones.find(b=>b.name==='head').parent,'spine');assert.equal(pb.bones.find(b=>b.name==='spine').length,pa.bones.find(b=>b.name==='spine').length*2)
 assert.deepEqual(pa.bones.find(b=>b.name==='spine').rest.quaternion,a.nodes.spine.quaternion.toArray());assert.ok(pa.capabilities.optionalBones.includes('chest'));assert.ok(!pb.capabilities.optionalBones.includes('chest'));assert.ok(pa.capabilities.missingRequiredBones.includes('leftUpperLeg'));assert.ok(!pa.capabilities.missingRequiredBones.includes('hips'));assert.equal(pa.unknownJointLimits,null);assert.equal(pa.soleOffsets,null)
 a.nodes.spine.quaternion.identity();assert.deepEqual(createBodyProfile(a).bones.find(b=>b.name==='spine').rest,pa.bones.find(b=>b.name==='spine').rest)
})
test('absolute local capture replays exactly and idempotently on nonidentity rest',async()=>{
 const {capturePoseRecord,applyPoseRecord,comparePoseRecords}=await import('../src/motion/motion-record.mjs'),vrm=await fixture(),record=capturePoseRecord(vrm,{time:2,stage:'retarget'})
 vrm.nodes.hips.position.x=5;vrm.nodes.spine.quaternion.identity();applyPoseRecord(vrm,record);applyPoseRecord(vrm,record)
 const after=capturePoseRecord(vrm,{time:2,stage:'replay'}),delta=comparePoseRecords(record,after)
 assert.deepEqual(after.joints,record.joints);assert.ok(delta.maxAngular<1e-7);assert.equal(delta.maxPosition,0);assert.equal(after.sourceTime,2)
 vrm.nodes.hips.position.x+=.25;const moved=comparePoseRecords(after,capturePoseRecord(vrm));assert.ok(Math.abs(moved.rootPosition-.25)<1e-12);assert.ok(Math.abs(moved.maxPosition-.25)<1e-12)
})
test('invalid records and unavailable bones are rejected before any mutation',async()=>{
 const {capturePoseRecord,applyPoseRecord}=await import('../src/motion/motion-record.mjs'),vrm=await fixture(),base=capturePoseRecord(vrm)
 for(const mutate of [r=>r.joints.spine.rotation=[0,0,0,2],r=>r.joints.head.position[0]=NaN,r=>r.time=-1,r=>r.sourceTime=Infinity,r=>r.joints.leftEye={position:[0,0,0],rotation:[0,0,0,1]},r=>r.root.position[0]=4]) {
  const bad=structuredClone(base);bad.joints.spine.position[0]=7;mutate(bad);assert.throws(()=>applyPoseRecord(vrm,bad));assert.deepEqual(capturePoseRecord(vrm).joints,base.joints)
 }
 const noHips=await fixture();delete noHips.nodes.hips;assert.throws(()=>capturePoseRecord(noHips),/hips/)
})
test('comparison measures rotation and treats quaternion signs as the same orientation',async()=>{
 const {capturePoseRecord,comparePoseRecords}=await import('../src/motion/motion-record.mjs'),vrm=await fixture(),before=capturePoseRecord(vrm),after=structuredClone(before)
 after.joints.head.rotation=[0,Math.sin(.3),0,Math.cos(.3)]
 assert.ok(Math.abs(comparePoseRecords(before,after).perJoint.head.angularRadians-.6)<1e-12)
 after.joints.head.rotation=before.joints.head.rotation.map(v=>-v)
 assert.equal(comparePoseRecords(before,after).perJoint.head.angularRadians,0)
})

test('every record declares its coordinates and rejects missing or mismatched coordinate conventions atomically',async()=>{
 const {capturePoseRecord,applyPoseRecord,comparePoseRecords}=await import('../src/motion/motion-record.mjs'),vrm=await fixture(),base=capturePoseRecord(vrm)
 assert.deepEqual(base.coordinate,{unit:'metre',space:'normalized-local-absolute',quaternion:'xyzw'})
 for(const coordinate of [undefined,{...base.coordinate,unit:'centimetre'},{...base.coordinate,space:'source-local-absolute'},{...base.coordinate,space:'normalized-local-relative'},{...base.coordinate,quaternion:'wxyz'}]) {
  const bad=structuredClone(base);bad.coordinate=coordinate;bad.joints.spine.position[0]=10
  assert.throws(()=>applyPoseRecord(vrm,bad),/coordinate/);assert.throws(()=>comparePoseRecords(base,bad),/coordinate/)
  assert.deepEqual(capturePoseRecord(vrm).joints,base.joints)
 }
})
