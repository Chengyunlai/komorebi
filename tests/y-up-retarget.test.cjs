const {test}=require('node:test'),assert=require('node:assert/strict');
async function fixture(){
 const [{createRotationFixture},{createVRMRetarget},{skeletonAt},{Vector3,Quaternion}]=await Promise.all([import('../examples/stage-15-rotation-retarget/core/rotation-body.mjs'),import('../src/motion-lab/vrm-retarget.mjs'),import('../src/motion-lab/bvh.mjs'),import('three')]);
 const body=createRotationFixture(1,0),bvh=body.bvh;
 for(let f=0;f<bvh.frameCount;f++){bvh.values[f*bvh.channelCount+3]=20;bvh.values[f*bvh.channelCount]=0;bvh.values[f*bvh.channelCount+1]+=.003*f}
 return {...body,createVRMRetarget,skeletonAt,Vector3,Quaternion};
}
test('y-up alignment preserves gravity with leaned first source pose and retains legacy default',async()=>{
 const a=await fixture(),b=await fixture(),c=await fixture(),legacy=a.createVRMRetarget(a.vrm,a.bvh),explicit=b.createVRMRetarget(b.vrm,b.bvh,{worldAlignment:'body-basis'}),aligned=c.createVRMRetarget(c.vrm,c.bvh,{worldAlignment:'y-up'}),up=new a.Vector3(0,1,0);
 assert.deepEqual(legacy.sourceToTargetRotation,explicit.sourceToTargetRotation);assert.equal(legacy.worldAlignment,'body-basis');assert.equal(aligned.worldAlignment,'y-up');
 assert.ok(up.clone().applyQuaternion(new a.Quaternion().fromArray(legacy.sourceToTargetRotation)).distanceTo(up)>.3);
 assert.ok(up.clone().applyQuaternion(new a.Quaternion().fromArray(aligned.sourceToTargetRotation)).distanceTo(up)<1e-12);
 aligned.apply(0);assert.ok(c.nodes.hips.quaternion.angleTo(new a.Quaternion())>.3);
 assert.throws(()=>a.createVRMRetarget(a.vrm,a.bvh,{worldAlignment:'invalid'}),/世界坐标/);
});
test('y-up sampled and timed playback agree and pure vertical source travel preserves world Y at feet',async()=>{
 const a=await fixture(),b=await fixture(),ra=a.createVRMRetarget(a.vrm,a.bvh,{worldAlignment:'y-up',rootMode:'source'}),rb=b.createVRMRetarget(b.vrm,b.bvh,{worldAlignment:'y-up',rootMode:'source'}),p=()=>a.nodes.leftFoot.getWorldPosition(new a.Vector3());
 ra.apply(0);const before=p(),first=a.skeletonAt(a.bvh,0),time=31*a.bvh.frameTime,frame=a.skeletonAt(a.bvh,time),report=ra.apply(time);
 assert.deepEqual(report,rb.applyFrame(frame));for(const name of Object.keys(a.nodes)){assert.deepEqual(a.nodes[name].position.toArray(),b.nodes[name].position.toArray());assert.deepEqual(a.nodes[name].quaternion.toArray(),b.nodes[name].quaternion.toArray())}
 const delta=p().sub(before),expected=(frame.positions[0][1]-first.positions[0][1])*ra.scale;
 assert.ok(Math.abs(delta.y-expected)<1e-7);assert.ok(Math.abs(delta.x)<1e-7);assert.ok(Math.abs(delta.z)<1e-7);
 const source=a.bvh.joints.findIndex(j=>j.name==='Foot_L');assert.ok(Math.abs(frame.positions[source][2]-first.positions[source][2])<1e-7);
});
