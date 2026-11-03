const {test}=require('node:test'),assert=require('node:assert/strict');
test('A/B phrase joins preserve position and velocity, with no forced rest at eight counts',async()=>{
 const {samplePhrase}=await import('../src/motion/vrm-phrases.mjs'),h=1e-5;
 for(const a of [0,1,2,3,4,5])for(const b of [0,1,2,3,4,5]){const end=samplePhrase(8-h,a).features,seam=samplePhrase(0,b).features,start=samplePhrase(h,b).features;for(const key of Object.keys(seam)){assert.ok(Math.abs(end[key]-start[key])<.001,key);const left=(seam[key]-end[key])/h,right=(start[key]-seam[key])/h;assert.ok(Math.abs(left-right)<.003,key+' velocity')}}
 const seam=samplePhrase(8).features;assert.ok(Math.abs(seam.shift)>.3);assert.ok(seam.leftElbow>.2);assert.ok(seam.leftReach>.2);
});
test('support feet stay planted while the other foot swings',async()=>{
 const {footAt}=await import('../src/motion/vrm-phrases.mjs');for(let b=1.05;b<1.95;b+=.05){const left=footAt('left',b),right=footAt('right',b);assert.equal(left.contact,true);assert.equal(left.y,0);assert.equal(left.x,.14);assert.ok(right.y>0)}
 for(let b=0;b<8;b+=.01){const l=footAt('left',b),r=footAt('right',b);assert.ok(l.y===0||r.y===0,'one support foot required')}
});
function signal(frame,bpm=120){return {streamId:'phrase-test',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:Math.floor(frame/(1800/bpm))*Math.round(48000*60/bpm),state:'tracking',energy:.8,bands:{low:.8,mid:.1,high:.1},tempo:{bpm,confidence:.7,phase:0}}}
test('the same phrase scales with tempo; onsets never reset the running clock',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');for(const bpm of [90,120]){const d=new VRMDanceController();let p;for(let frame=0;frame<=120;frame++)p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:signal(frame,bpm)});assert.ok(Math.abs(p.source.beat-4*bpm/60)<1e-6);assert.ok(Math.abs(p.source.bpm-bpm)<1e-6)}
 const d=new VRMDanceController();let last=0;for(let frame=0;frame<300;frame++){const s=signal(frame);s.lastOnsetFrame=frame*1600;const p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:s});assert.ok(p.source.beat>=last);assert.ok(p.source.beat-last<.08);last=p.source.beat}
});
test('energy fluctuations do not drag a planted foot; stop freezes clock and settles',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController();let p;for(let frame=0;frame<44;frame++)p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:{...signal(frame),energy:frame%2?.1:.9}});assert.equal(p.contacts.left,true);assert.ok(Math.abs(p.feet.left[0]-.14/0.18*.34)<1e-6);
 const beat=p.source.beat;for(let i=0;i<100;i++)p=d.step({dt:1/30,audioMode:true,signalAge:2});assert.equal(p.source.beat,beat);assert.ok(p.source.strength<1e-6);assert.ok(p.feet.left.every(v=>Math.abs(v)<1e-9));
});
test('all themes vary body and foot paths without moving a planted foot',async()=>{
 const {samplePhrase,footAt,PHRASE_THEMES}=await import('../src/motion/vrm-phrases.mjs');assert.equal(PHRASE_THEMES.length,12);const signatures=[];
 for(let theme=0;theme<12;theme++){const sig=[];for(let beat=0;beat<8;beat+=.1){const sample=samplePhrase(beat,theme);assert.ok(Object.values(sample.features).every(Number.isFinite));const l=footAt('left',beat,theme),r=footAt('right',beat,theme);assert.ok(l.contact||r.contact);sig.push(sample.features.twist,sample.features.leftFront,sample.features.leftReach,sample.features.rightReach,sample.features.fold,sample.features.drop,sample.features.lean,sample.features.shift,l.z,l.y)}signatures.push(sig);const a=footAt('left',1.1,theme),b=footAt('left',1.9,theme);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(a.y,0);}
 for(let a=0;a<12;a++)for(let b=a+1;b<12;b++)assert.ok(signatures[a].reduce((sum,v,i)=>sum+(v-signatures[b][i])**2,0)>.5,'themes must differ beyond labels');
});
test('boundary scheduler develops selected motifs under steady music and never switches mid-phrase',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const controller=new VRMDanceController(),seen=new Set();let previous;
 for(let frame=0;frame<3600;frame++){const p=controller.step({dt:1/30,audioMode:true,signalAge:0,signal:signal(frame)});seen.add(p.source.variation);if(previous&&p.source.variation!==previous.variation)assert.ok(Math.floor(p.source.beat/8)>Math.floor(previous.beat/8));previous=p.source}
 assert.ok(seen.size>=3&&seen.size<=12,'scheduler should explore several themes without exhausting all of them');
});
