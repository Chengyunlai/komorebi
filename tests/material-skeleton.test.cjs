const {test}=require('node:test'),assert=require('node:assert/strict');
test('material skeleton reconstructs source matrices and units at every exact frame',async()=>{
 const {createRotationFixture}=await import('../examples/stage-15-rotation-retarget/core/rotation-body.mjs');const {buildSourceMotionMaterial,sampleSourceMaterial}=await import('../src/motion/source-material.mjs');const {sourcePoseToSkeleton}=await import('../src/motion/material-skeleton.mjs');const {skeletonAt}=await import('../src/motion-lab/bvh.mjs');
 const b=createRotationFixture().bvh,m=buildSourceMotionMaterial(b,{metersPerUnit:.01});
 for(let f=0;f<b.frameCount;f++){const t=f*b.frameTime,a=skeletonAt(b,t),r=sourcePoseToSkeleton(m,sampleSourceMaterial(m,t));for(let j=0;j<b.joints.length;j++)for(let k=0;k<16;k++)assert.ok(Math.abs(a.matrices[j][k]-r.matrices[j][k])<1e-8);}
 assert.throws(()=>sourcePoseToSkeleton({...m,metersPerUnit:0},m.frames[0]));const bad=structuredClone(m.frames[0]);bad.joints[m.rig[0].id].rotation=[0,0,0,0];assert.throws(()=>sourcePoseToSkeleton(m,bad));
});
