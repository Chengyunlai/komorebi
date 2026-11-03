const {test}=require('node:test'),assert=require('node:assert/strict')
function frames(count=900){return Array.from({length:count},(_,i)=>{const a=.7*Math.sin(2*Math.PI*i/7.5),q=[Math.sin(a/2),0,0,Math.cos(a/2)];return {rotations:{hips:[0,0,0,1],chest:q,leftUpperArm:q,leftUpperLeg:q},hips:[0,0,0],feet:{left:[.1,0,0],right:[-.1,0,0]}}})}
test('unreliable music tempo preserves authored speed rather than applying a 100/120 slowdown',async()=>{
 const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs'),p=createFreestyleMotionPlayer(frames())
 let a=p.step({dt:1/60,active:true,bpm:100,musicReliable:false}),start=a.sourceFrame
 for(let i=0;i<60;i++)a=p.step({dt:1/60,active:true,bpm:100,musicReliable:false})
 assert.ok(Math.abs(a.sourceFrame-start-15)<1e-6);assert.equal(a.rhythm.rate,1);assert.equal(a.rhythm.mode,'onset-reactive')
})
test('symmetric source smoothing preserves the timing of a known movement peak',async()=>{
 const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs'),p=createFreestyleMotionPlayer(frames(),{segmentSeconds:20})
 let error=0,crossings=0
 for(let i=0;i<120;i++){
  const a=p.step({dt:1/60,active:true});const expected=.7*Math.sin(2*Math.PI*a.sourceFrame/7.5)
  const actual=2*Math.atan2(a.rotations.leftUpperLeg[0],a.rotations.leftUpperLeg[3])
  // Some attenuation is expected; there must be no causal phase delay.
  if(Math.abs(expected)<.01){crossings++;error=Math.max(error,Math.abs(actual))}
 }
 assert.ok(crossings>=3);assert.ok(error<.01,`zero crossing lag ${error}`)
})
test('onset response is immediate, decays, and leaves source arm articulation unchanged',async()=>{
 const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs'),a=createFreestyleMotionPlayer(frames()),b=createFreestyleMotionPlayer(frames())
 let excited,plain,min=0
 for(let i=0;i<90;i++){
  excited=a.step({dt:1/60,active:true,onset:i===10,onsetStrength:1});plain=b.step({dt:1/60,active:true});min=Math.min(min,excited.hips[1]-plain.hips[1]);assert.deepEqual(excited.rotations.leftUpperArm,plain.rotations.leftUpperArm)
  if(i===11)assert.ok(excited.hips[1]<-.001)
 }
 assert.ok(min<-.003);assert.ok(Math.abs(excited.hips[1])<1e-5)
})
test('kinematic phase locking corrects phase through bounded forward speed, without seeking',async()=>{
 const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs'),{motionPulsePhase}=await import('../src/motion/motion-pulses.mjs')
 // Explicit source tempo is known in this synthetic recording.
 const p=createFreestyleMotionPlayer(frames(),{segmentSeconds:20,sourceBpm:120})
 const track=p.bank.clips[0].pulses;assert.ok(track.period)
 let pose=p.step({dt:1/60,active:true,bpm:120,musicReliable:true,musicPhase:.3}),previous=pose.sourceFrame,first
 for(let i=1;i<360;i++){
  const phase=(.3+i/30)%1;pose=p.step({dt:1/60,active:true,bpm:120,musicReliable:true,musicPhase:phase})
  assert.ok(pose.sourceFrame>=previous);assert.ok(pose.sourceFrame-previous<=15*1.5/60+1e-6);previous=pose.sourceFrame
  const e=((phase-motionPulsePhase(track,pose.sourceFrame,15)+.5)%1+1)%1-.5
  if(i===1)first=Math.abs(e)
  if(i===359)assert.ok(Math.abs(e)<.1&&Math.abs(e)<first,`phase should converge below 50ms at 120BPM: ${first} -> ${Math.abs(e)}`)
 }
 assert.equal(pose.rhythm.mode,'kinematic-pulse-lock')
})

test('manual rhythm preference remains effective when music timing is uncertain',async()=>{
 const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs'),p=createFreestyleMotionPlayer(frames())
 let pose;for(let i=0;i<120;i++)pose=p.step({dt:1/60,active:true,musicReliable:false,tempoScale:1.4})
 assert.ok(pose.rhythm.rate>1.39&&pose.rhythm.rate<=1.4)
})

test('quiet measured hits retain a readable body response across render rates without changing arms',async()=>{
 const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs')
 for(const hz of [30,60,120]){
  const p=createFreestyleMotionPlayer(frames()),baseline=createFreestyleMotionPlayer(frames());let peak=0,late=0
  for(let i=0;i<hz;i++){
   const hit=p.step({dt:1/hz,active:true,onset:i===0,onsetStrength:.08}),plain=baseline.step({dt:1/hz,active:true})
   const dip=plain.hips[1]-hit.hips[1];peak=Math.max(peak,dip);if(i===Math.round(.1*hz))late=dip
   assert.deepEqual(hit.rotations.leftUpperArm,plain.rotations.leftUpperArm)
  }
  assert.ok(peak>.004,`readable peak at ${hz}Hz: ${peak}`);assert.ok(late>.002,`hit persists at 100ms: ${late}`)
 }
})
