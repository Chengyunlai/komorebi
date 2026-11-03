const test=require('node:test'),assert=require('node:assert/strict');
const packet=(time,onset,bands={low:.8,mid:.2,high:.1})=>({streamId:'test',sampleRate:48000,sampleFrame:Math.round(time*48000),lastOnsetFrame:onset===null?null:Math.round(onset*48000),energy:.8,state:'tracking',bands,onsetStrength:.6,tempo:{bpm:120,confidence:.8,phase:0}});
async function play(bands,onsets){
 const {MusicMotionSimulator}=await import('../src/motion/music-motion-simulator.mjs');const sim=new MusicMotionSimulator(),out=[];let onset=null;
 for(let i=0;i<120;i++){const t=i/60;if(onsets.some(x=>Math.abs(x-t)<.001))onset=t;out.push(sim.step({dt:1/60,signal:packet(t,onset,bands),signalAge:0}));}return {sim,out};
}
test('相同BPM和能量下，频段或起音时序不同会产生不同动作轨迹',async()=>{
 const low=await play({low:.8,mid:.1,high:.1},[.2,.7,1.2]);
 const mid=await play({low:.1,mid:.8,high:.1},[.2,.7,1.2]);
 const offbeat=await play({low:.8,mid:.1,high:.1},[.3,.9,1.6]);
 assert.equal(low.out.at(-1).eventCount,3);assert.notDeepEqual(low.out,mid.out);assert.notDeepEqual(low.out,offbeat.out);
 assert.equal(mid.out[20].primitive,'open-arms');assert.equal(mid.out[20].leftArm,mid.out[20].rightArm);
 assert.notEqual(low.out[20].leftArm,low.out[20].rightArm);
});
test('持续包不重复触发，也不会按BPM自己生成动作；静音断流收势',async()=>{
 const {sim,out}=await play({low:.8,mid:.1,high:.1},[.2]);
 assert.equal(out.at(-1).eventCount,1);assert.ok(Math.abs(out.at(-1).leftArm)<.001);
 for(let i=0;i<90;i++)sim.step({dt:1/60,signal:packet(2+i/60,.2),signalAge:1});
 assert.ok(sim.strength<.001);assert.ok(Object.values(sim.position).every(v=>Math.abs(v)<.001));
 const silent=sim.step({dt:1/60,signal:{...packet(4,4),state:'silent',energy:0},signalAge:0});assert.equal(silent.eventCount,1);
});
test('换流不重播陈旧起音；不支持的手臂通道不会输出运动',async()=>{
 const {MusicMotionSimulator}=await import('../src/motion/music-motion-simulator.mjs');const sim=new MusicMotionSimulator({capabilities:['headY','bodyY']});
 let pose;for(let i=0;i<20;i++)pose=sim.step({dt:1/60,signal:packet(i/60,0),signalAge:0});
 assert.equal(pose.leftArm,0);assert.notEqual(pose.headY,0);
 pose=sim.step({dt:1/60,signal:{...packet(10,0),streamId:'new'},signalAge:0});assert.equal(pose.eventCount,0);
});
