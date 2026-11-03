const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const sourcePromise=import('../src/motion/default-idle.mjs').then(m=>m.defaultIdleMotion);
test('original idle expresses head/body gestures with fixed feet and a seamless loop',async()=>{
 const source=await sourcePromise;
 const {VRMIdleController}=await import('../src/motion/vrm-idle.mjs');const idle=new VRMIdleController(source);const samples=Array.from({length:100},(_,i)=>idle.sample(i/100*idle.period));assert.ok(Math.min(...samples.map(p=>p.rotations.head[1]))<-.2);assert.ok(Math.max(...samples.map(p=>p.rotations.head[0]))>.05);assert.ok(samples.every(p=>Math.abs(p.hips[1])<.01));
 const a=idle.sample(idle.period-1e-5),b=idle.sample(1e-5);for(const key of Object.keys(a.rotations))for(let i=0;i<3;i++)assert.ok(Math.abs(a.rotations[key][i]-b.rotations[key][i])<.001,key);
 assert.ok(samples.every(p=>p.expressions.blinkLeft>=0&&p.expressions.blinkLeft<=1));
});
test('music preempts idle, returning smoothly afterward; reduced motion disables idle movement',async()=>{
 const source=await sourcePromise;
 const {VRMIdleController}=await import('../src/motion/vrm-idle.mjs');const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const idle=new VRMIdleController(source),dance=new VRMDanceController();const base=dance.step({dt:1/30});let p;
 for(let i=0;i<100;i++)p=idle.step({dt:1/30,pose:{...base,source:{strength:.8}}});assert.ok(p.idle.weight<1e-5);
 for(let i=0;i<100;i++)p=idle.step({dt:1/30,pose:base});assert.ok(p.idle.weight>.99);assert.ok(Math.abs(p.rotations.head[1])>.01);
 p=idle.step({dt:1/30,pose:base,reducedMotion:true});assert.equal(p.idle.weight,0);assert.ok(p.rotations.head.every((v,i)=>Math.abs(v-base.rotations.head[i])<1e-9));assert.ok(p.feet.left.every(v=>v===0));
});
test('a quiet but active musical phrase keeps ownership over idle',async()=>{
 const source=await sourcePromise;
 const {VRMIdleController}=await import('../src/motion/vrm-idle.mjs');const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const idle=new VRMIdleController(source),base=new VRMDanceController().step({dt:1/30});let p;
 for(let i=0;i<100;i++)p=idle.step({dt:1/30,pose:{...base,source:{mode:'audio',primitive:'phrase-A',strength:.15}}});assert.ok(p.idle.weight<1e-5);
});
