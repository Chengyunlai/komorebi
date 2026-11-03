const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('原始日和8个动作完整解析，时间端点不偏移',{skip:!fs.existsSync(path.join(__dirname,'../public/vendor/hiyori_free_zh/runtime/motion/hiyori_m01.motion3.json'))},async()=>{
 const {parseMotion,sampleCurve}=await import('../src/motion-lab/curves.mjs');
 for(let i=1;i<=8;i++){
  const json=JSON.parse(fs.readFileSync(path.join(__dirname,`../public/vendor/hiyori_free_zh/runtime/motion/hiyori_m0${i}.motion3.json`)));
  const motion=parseMotion(json);assert.equal(motion.curves.filter(c=>c.target==='Parameter').length,21);
  for(const c of motion.curves){assert.equal(sampleCurve(c,0),c.start.v);assert.equal(sampleCurve(c,motion.duration),c.end.v);for(let t=0;t<motion.duration;t+=.03)assert.ok(Number.isFinite(sampleCurve(c,t)));}
 }
});
test('非线性Bezier按时间求解，不把播放时间直接当成Bezier参数',async()=>{
 const {parseMotion,sampleCurve}=await import('../src/motion-lab/curves.mjs');
 const make=segments=>parseMotion({Meta:{Duration:1,Fps:30},Curves:[{Id:'ParamAngleX',Target:'Parameter',Segments:segments}]}).curves[0];
 assert.ok(Math.abs(sampleCurve(make([0,0,1,.1,0,.8,1,1,1]),.4625)-.5)<1e-8);
 assert.equal(sampleCurve(make([0,2,0,1,4]),.5),3);
 assert.equal(sampleCurve(make([0,2,2,1,4]),.5),2);
 assert.equal(sampleCurve(make([0,2,3,1,4]),.5),4);
 assert.throws(()=>make([0,0,1,.1,0]));
});
test('BVH尊重声明的旋转顺序及父子变换，逐帧定位无越界',async()=>{
 const {parseBVH,skeletonAt}=await import('../src/motion-lab/bvh.mjs');
 const text='HIERARCHY ROOT Root { OFFSET 0 0 0 CHANNELS 2 Xposition Zrotation JOINT Child { OFFSET 1 0 0 End Site { OFFSET 1 0 0 } } } MOTION Frames: 2 Frame Time: 0.1 0 0 10 90';
 const bvh=parseBVH(text);assert.equal(bvh.channelCount,2);assert.equal(bvh.joints.length,3);
 const frame=skeletonAt(bvh,.1);assert.equal(frame.frame,1);assert.ok(Math.abs(frame.positions[1][0]-10)<1e-8);assert.ok(Math.abs(frame.positions[1][1]-1)<1e-8);assert.ok(Math.abs(frame.positions[2][1]-2)<1e-8);assert.equal(skeletonAt(bvh,100).frame,1);
 assert.throws(()=>parseBVH(text+' 5'));assert.throws(()=>parseBVH(text.replace('Frame Time: 0.1','Frame Time: 0')));
});
test('六通道关节不重复叠加OFFSET；辅助根节点不画成人体长骨',async()=>{
 const {parseBVH,skeletonAt,anatomicalEdges}=await import('../src/motion-lab/bvh.mjs');
 const bvh=parseBVH('HIERARCHY ROOT joint_Root { OFFSET 0 0 0 CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation JOINT Hips { OFFSET 0 90 0 CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation JOINT Spine { OFFSET 0 15 0 CHANNELS 3 Zrotation Xrotation Yrotation } } } MOTION Frames: 1 Frame Time: 0.0333333 0 0 0 0 0 0 0 100 0 0 0 0 0 0 0');
 const pose=skeletonAt(bvh,0);assert.equal(pose.positions[1][1],100);assert.equal(pose.positions[2][1],115);
 assert.deepEqual(anatomicalEdges(bvh).map(e=>[e.from,e.to]),[[1,2]]);
});
