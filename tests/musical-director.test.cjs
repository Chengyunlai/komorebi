const {test}=require('node:test'),assert=require('node:assert/strict');
test('director repeats and answers a motif before contrast and return',async()=>{
 const {MusicalDirector}=await import('../src/motion/musical-director.mjs');const d=new MusicalDirector();let current=0;const sequence=[];const choose=(candidates,previous)=>candidates.find(n=>n!==previous)??candidates[0];
 for(let i=0;i<4;i++){current=d.boundary(current,choose);sequence.push(current)}assert.deepEqual(sequence.slice(0,3),[0,1,0]);assert.notEqual(sequence[3],0);
});
test('quiet and percussive inputs select different response modes with hysteresis',async()=>{
 const {MusicalDirector}=await import('../src/motion/musical-director.mjs');const quiet=new MusicalDirector(),drive=new MusicalDirector();let q,r;
 for(let frame=0;frame<300;frame++){q=quiet.step({dt:1/30,energy:.12,audible:true});r=drive.step({dt:1/30,energy:.85,onset:frame%15===0,onsetStrength:1,audible:true})}assert.equal(q.mode,'quiet');assert.equal(r.mode,'drive');assert.ok(r.dynamics>q.dynamics+.2);
 quiet.step({dt:1/30,energy:.9,onset:true,audible:true});assert.equal(quiet.mode,'quiet');
 let candidates;quiet.boundary(0,(list)=>{candidates=list;return list[0]});assert.ok(!candidates.includes(3));
});
test('accent changes articulation while preserving feet and answer seams',async()=>{
 const {samplePhrase}=await import('../src/motion/vrm-phrases.mjs');const plain=samplePhrase(2.4,3),accented=samplePhrase(2.4,3,{accent:1,answer:true});assert.ok(accented.features.leftElbow>plain.features.leftElbow);for(const key of ['stepL','stepR','liftL','liftR','forwardL','forwardR'])assert.equal(plain.features[key],accented.features[key]);
 for(let theme=0;theme<6;theme++){const a=samplePhrase(8-1e-5,theme,{answer:true}).features,b=samplePhrase(1e-5,0).features;for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<.001)}
});
function signal(frame,bpm=120,confidence=.7){return {streamId:'tempo',sampleRate:48000,sampleFrame:frame*1600,lastOnsetFrame:Math.floor(frame/15)*24000,state:'tracking',energy:.6,bands:{low:.4,mid:.3,high:.2},tempo:{bpm,confidence},onsetStrength:.8}}
test('tempo survives confidence gaps and octave ambiguity without phase resets',async()=>{
 const {VRMDanceController}=await import('../src/motion/vrm-dance.mjs');const d=new VRMDanceController();let p;
 for(let i=0;i<30;i++)p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:signal(i),tempo:80});
 for(let i=30;i<110;i++){p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:signal(i,60,0),tempo:80});assert.ok(Math.abs(p.source.bpm-120)<1e-8)}
 let beat=p.source.beat;for(let i=110;i<230;i++){p=d.step({dt:1/30,audioMode:true,signalAge:0,signal:signal(i,i%2?120:60,.9),tempo:80});assert.ok(Math.abs(p.source.bpm-120)<1e-8);assert.ok(p.source.beat>=beat);beat=p.source.beat}
});
test('sustained rises and drops affect expression without claiming a song section',async()=>{
 const {MusicalDirector}=await import('../src/motion/musical-director.mjs');const d=new MusicalDirector(),modes=new Set();
 for(const energy of [.15,.85,.15])for(let i=0;i<120;i++)modes.add(d.step({dt:1/30,energy,onset:i%15===0,onsetStrength:.8,audible:true}).mode);
 assert.ok(modes.has('rising'));assert.ok(modes.has('settling'));assert.ok(!modes.has('chorus'));
});
