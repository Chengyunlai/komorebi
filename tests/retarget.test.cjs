const test=require('node:test'),assert=require('node:assert/strict');
function skeleton(){return {frameTime:1/30,frameCount:2,channelCount:8,duration:2/30,joints:[{name:'Hips',parent:-1,offset:[0,0,0],channels:['Xposition','Yposition','Zposition'],channelStart:0},{name:'Neck',parent:0,offset:[0,2,0],channels:[],channelStart:3},{name:'Head',parent:1,offset:[0,1,0],channels:['Xrotation','Yrotation','Zrotation'],channelStart:3},{name:'UpperArm_L',parent:1,offset:[-1,-.2,0],channels:['Zrotation'],channelStart:6},{name:'LowerArm_L',parent:3,offset:[0,-1,0],channels:[],channelStart:7},{name:'UpperArm_R',parent:1,offset:[1,-.2,0],channels:['Zrotation'],channelStart:7},{name:'LowerArm_R',parent:5,offset:[0,-1,0],channels:[],channelStart:8}],values:Float32Array.from([0,0,0,0,0,0,0,0,10,50,90,20,10,5,90,0])};}
test('手臂抬起保持左右独立；整体平移不伪造成躯干动作',async()=>{
 const {measureUpperBody,retargetPose}=await import('../src/motion-lab/retarget.mjs');const bvh=skeleton(),rest=measureUpperBody(bvh,0),raised=measureUpperBody(bvh,1/30),result=retargetPose(raised,rest);
 assert.ok(Math.abs(raised.leftElevation-90)<1e-6);assert.ok(Math.abs(raised.rightElevation)<1e-6);
 assert.ok(Math.abs(result.pose.ParamArmLA-.5)<1e-6);assert.equal(result.pose.ParamArmRA,-1);
 for(const id of ['ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ'])assert.ok(Math.abs(result.pose[id])<1e-8);assert.ok(result.head.pitch>10);
 const mirrored=retargetPose(raised,rest,{mirror:true});assert.equal(mirrored.pose.ParamArmLA,-1);assert.ok(Math.abs(mirrored.pose.ParamArmRA-.5)<1e-6);
});
test('生成动作保持原始时间、只写8个真实通道、限幅和关闭增益可复现',async()=>{
 const {RETARGET_IDS,buildRetargetMotion}=await import('../src/motion-lab/retarget.mjs');const rig=RETARGET_IDS.map(id=>({id,min:-10,max:10,neutral:0}));
 const result=buildRetargetMotion(skeleton(),rig,{gain:2});assert.equal(result.source.Curves.length,8);assert.equal(result.source.Meta.Duration,1/30);assert.ok(result.stats.maxNormalizedStep<=4/30+1e-8);
 for(const curve of result.source.Curves){assert.equal(curve.Segments[0],0);assert.equal(curve.Segments[3],1/30);for(const i of [1,4])assert.ok(Math.abs(curve.Segments[i])<=10)}
 const zero=buildRetargetMotion(skeleton(),rig,{gain:0});for(const c of zero.source.Curves)assert.equal(c.Segments[4],c.Id.includes('Arm')?-10:0);
 assert.throws(()=>buildRetargetMotion(skeleton(),rig.slice(1)));assert.throws(()=>buildRetargetMotion(skeleton(),rig,{gain:NaN}));
});
test('缺少关节或退化参考轴时拒绝伪造映射',async()=>{
 const {measureUpperBody}=await import('../src/motion-lab/retarget.mjs');const bvh=skeleton();bvh.joints[2].name='unknown';assert.throws(()=>measureUpperBody(bvh,0));
});
