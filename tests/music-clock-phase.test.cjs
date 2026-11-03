const {test}=require('node:test');const assert=require('node:assert/strict');
const phaseError=(a,b)=>Math.abs((a-b)-Math.round(a-b));
test('reliable onset phase gently closes large offsets without restarting gait',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');
 for(const offset of [.35,.4,-.4]){
  const d=new VRMDanceController();d.beat=8+offset;d.bpm=120;d.clockReady=true;let previous=d.beat,p;
  for(let i=0;i<=300;i++){
   const time=i/30;p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId:'phase',sampleRate:48000,sampleFrame:i*1600,lastOnsetFrame:Math.floor(time*2)*24000,state:'tracking',energy:.8,tempo:{bpm:120,confidence:.95,phase:(time*2)%1}}});
   assert.ok(p.source.beat>=previous);assert.ok(p.source.beat-previous<=2.18/30+1e-9);previous=p.source.beat;
  }
  assert.ok(phaseError(p.source.beat,20)<.005);assert.ok(p.source.beat>27);assert.equal(p.source.clockEpoch,1);
 }
});
test('clock epoch changes on new stream or rewind while beat remains continuous',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController();
 const step=(streamId,sampleFrame)=>d.step({dt:1/30,audioMode:true,signalAge:0,signal:{streamId,sampleRate:48000,sampleFrame,state:'active',energy:.8}}).source;
 assert.equal(step('a',48000).clockEpoch,1);const before=step('a',49600);const changed=step('b',0);assert.equal(changed.clockEpoch,2);assert.equal(changed.beat,before.beat);
 step('b',48000);const rewind=step('b',0);assert.equal(rewind.clockEpoch,3);assert.ok(rewind.beat>=changed.beat);
});
test('untrusted tempo phase cannot pull the clock',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController();d.beat=.4;d.bpm=120;d.clockReady=true;
 for(let i=0;i<=30;i++)d.step({dt:1/30,tempo:120,audioMode:true,signalAge:0,signal:{streamId:'low',sampleRate:48000,sampleFrame:i*1600,lastOnsetFrame:Math.floor(i/15)*24000,state:'active',energy:.8,tempo:{bpm:120,confidence:.3,phase:0}}});
 assert.ok(Math.abs(d.beat-2.4)<1e-9);
});
