const {test}=require('node:test'),assert=require('node:assert/strict');
test('material sequence shares one alignment through blend and incoming; mixed contact stays unknown',async()=>{
 const {createRotationFixture}=await import('../examples/stage-15-rotation-retarget/core/rotation-body.mjs'),{buildSourceMotionMaterial}=await import('../src/motion/source-material.mjs'),{createMaterialSequence}=await import('../src/motion/material-sequence.mjs');
 const m=buildSourceMotionMaterial(createRotationFixture().bvh,{metersPerUnit:1}),contacts={sample:time=>({left:{state:'plant',knowledge:'annotated',provenance:'original test fixture'},right:{state:'plant',knowledge:'annotated',provenance:'original test fixture'}})},p=createMaterialSequence(m,{outgoingStart:.1,incomingStart:.7,total:1.5,transitionStart:.5,transitionDuration:.3,contacts});
 assert.equal(p.sample(.49).evidence.left.knowledge,'annotated');for(const t of [.5,.7,.8])assert.equal(p.sample(t).evidence.left.knowledge,'unknown');assert.equal(p.sample(.801).evidence.left.knowledge,'annotated');assert.equal(p.sample(1).phase,'incoming');
 const a=p.sample(.8).pose,b=p.sample(.800001).pose;assert.ok(Math.hypot(...a.root.position.map((v,i)=>v-b.root.position[i]))<1e-4);assert.throws(()=>p.sample(1.51));assert.throws(()=>createMaterialSequence(m,{incomingStart:100}));
});
