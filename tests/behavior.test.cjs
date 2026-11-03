const test=require('node:test');const assert=require('node:assert/strict');
const {validateDecision}=require('../electron/behavior.cjs');
test('模型低置信度、其他意图不执行，非法输出拒绝',()=>{
 assert.equal(validateDecision({choice:'gentle',confidence:.9}).accepted,true);
 assert.equal(validateDecision({choice:'stop',confidence:.4}).accepted,false);
 assert.equal(validateDecision({choice:'other',confidence:.99}).accepted,false);
 assert.throws(()=>validateDecision({choice:'run_code',confidence:1}));
 assert.throws(()=>validateDecision({choice:'stop',confidence:NaN}));
});
test('动作模式具有不同的手臂协同；收势归零并限制参数范围',async()=>{
 const {applyBehaviorPose}=await import('../src/behavior-pose.mjs');
 const pose={strength:1,headX:.5,headY:.5,headZ:.5,bodyX:.5,bodyY:.5,bodyZ:.5,leftArm:.8,rightArm:.8};
 const gentle=applyBehaviorPose(pose,{choice:'gentle'},1,.5),energy=applyBehaviorPose(pose,{choice:'energetic'},1,.5);
 assert.equal(gentle.leftArm,gentle.rightArm);assert.notEqual(energy.leftArm,energy.rightArm);
 assert.equal(energy.leftArm,.9);assert.ok(gentle.headX<pose.headX);
 const stop=applyBehaviorPose(pose,{choice:'stop'},0);assert.equal(stop.headX,0);assert.equal(stop.strength,0);assert.equal(pose.headX,.5);
});
test('预加载桥允许模型意图广播到桌宠渲染器',()=>{
 const vm=require('node:vm'),fs=require('node:fs');let api,listener;
 vm.runInNewContext(fs.readFileSync(require.resolve('../electron/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_,value)=>api=value},ipcRenderer:{on:(channel,fn)=>{assert.equal(channel,'komorebi:behavior');listener=fn;},removeListener(){},invoke(){}}})});
 let received;api.on('behavior',value=>received=value);listener({}, {choice:'energetic'});assert.equal(received.choice,'energetic');
});

test('普通气泡行为请求进入模型；代码任务和带上下文的请求保留任务链路',async()=>{
 const {routeSubmission}=require('../electron/submission.cjs');let decisions=0,tasks=0;
 const deps={decide:async()=>{decisions++;return {accepted:true,state:{choice:'gentle'}}},startTask:()=>{tasks++;return {id:'task'}}};
 assert.equal((await routeSubmission({instruction:'轻轻跳'},deps)).kind,'behavior');
 await routeSubmission({instruction:'解释代码'},deps);
 await routeSubmission({instruction:'实现跳舞',context:'代码'},deps);
 assert.equal(decisions,1);assert.equal(tasks,2);
 deps.decide=async()=>({accepted:false});assert.equal((await routeSubmission({instruction:'如何实现跳舞'},deps)).id,'task');
});
