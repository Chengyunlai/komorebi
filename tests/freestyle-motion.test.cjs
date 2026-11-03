const {test} = require('node:test')
const assert = require('node:assert/strict')

function framesFixture(count = 300) {
  return Array.from({length: count}, (_, i) => ({
    rotations: {
      hips: [0, 0, 0, 1],
      spine: [0, 0, 0, 1],
      head: [0, 0, Math.sin(i / 10) * .4, Math.sqrt(1 - (Math.sin(i / 10) * .4) ** 2)],
      leftUpperArm: [Math.sin(i / 7) * .6, 0, 0, Math.sqrt(1 - (Math.sin(i / 7) * .6) ** 2)],
    },
    hips: [0, .01 * Math.sin(i / 9), 0],
    feet: {left: [.1, 0, .1 + .01 * Math.sin(i / 5)], right: [-.1, 0, -.1]},
  }))
}

test('freestyle player advances, switches segments and crossfades', async () => {
  const {createFreestyleMotionPlayer} = await import('../src/motion/freestyle-motion.mjs')
  const player = createFreestyleMotionPlayer(framesFixture(), {fps: 15, segmentSeconds: .6, crossfadeSeconds: .2})
  let pose = player.step({dt: 1 / 30, active: true, energy: .7, bpm: 120})
  assert.equal(pose.source.primitive, 'motion-matching')
  assert.ok(pose.weight > 0 && pose.weight < 1, 'entry fades into the body pose')
  const firstFrame = pose.sourceFrame
  let switches = 0
  for (let i = 0; i < 120; i++) {
    pose = player.step({dt: 1 / 30, active: true, energy: .7, bpm: 120})
    switches = Math.max(switches, pose.switches)
    for (const quat of Object.values(pose.rotations)) assert.ok(quat.every(Number.isFinite))
  }
  assert.ok(pose.sourceFrame !== firstFrame, 'playhead moved')
  assert.ok(switches >= 1, `expected segment switches, got ${switches}`)
})

test('near-static windows stay excluded at both quiet and high energy', async () => {
  const {createFreestyleMotionPlayer} = await import('../src/motion/freestyle-motion.mjs')
  const frames = Array.from({length: 600}, (_, i) => {
    // The first half is calm (tiny rotation), the second half is active (large rotation).
    const amp = i < 300 ? .05 : 1.2
    const value = Math.sin(i / 8) * amp
    return {
      rotations: {hips: [0, 0, 0, 1], leftUpperArm: [Math.sin(value/2), 0, 0, Math.cos(value/2)], leftUpperLeg: [Math.sin(value/4), 0, 0, Math.cos(value/4)]},
      hips: [0, 0, 0], feet: {left: [0, 0, 0], right: [0, 0, 0]},
    }
  })
  const run = (energy) => {
    const player = createFreestyleMotionPlayer(frames, {fps: 15, segmentSeconds: .5})
    const starts = []
    for (let i = 0; i < 200; i++) {
      const pose = player.step({dt: 1 / 30, active: true, energy, bpm: 120})
      if (pose.switches > starts.length) starts.push(pose.sourceFrame)
    }
    return starts
  }
  const activeStarts = run(.95), calmStarts = run(.05)
  const meanStart = list => list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : 0
  // Near-static stretches are now rejected, so both energy levels land in the active half.
  assert.ok(meanStart(activeStarts) >= 280, `active starts ${meanStart(activeStarts)} should be in the active half`)
  assert.ok(meanStart(calmStarts) >= 280, `calm starts ${meanStart(calmStarts)} should avoid the static half`)
})

test('inactive player returns a resting pose with zero weight and rejects bad input', async () => {
  const {createFreestyleMotionPlayer} = await import('../src/motion/freestyle-motion.mjs')
  const player = createFreestyleMotionPlayer(framesFixture(), {fps: 15})
  const pose = player.step({dt: 1 / 30, active: false})
  assert.equal(pose.weight, 0)
  assert.equal(pose.source.mode, 'waiting')
  assert.throws(() => createFreestyleMotionPlayer([]), TypeError)
  assert.throws(() => createFreestyleMotionPlayer(framesFixture(), {segmentSeconds: 0}), TypeError)
})

function constantPose(angle = 1) {
  return {rotations: {hips:[0,0,0,1],leftUpperArm:[Math.sin(angle/2),0,0,Math.cos(angle/2)]}, hips:[0,0,0],feet:{left:[.1,0,0],right:[-.1,0,0]}}
}

test('raw energy and accents cannot shake a stationary source pose', async () => {
  const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs')
  const player=createFreestyleMotionPlayer(Array.from({length:200},()=>constantPose()))
  for(let i=0;i<120;i++){
    const pose=player.step({dt:1/60,active:true,energy:i%2,accent:i%2,bpm:120})
    assert.ok(Math.abs(pose.rotations.leftUpperArm[0]-Math.sin(.5))<1e-10)
  }
})

test('onsets do not interrupt a complete movement window and stop fades out', async () => {
  const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs')
  const player=createFreestyleMotionPlayer(framesFixture(),{segmentSeconds:4.8})
  let pose
  for(let i=0;i<240;i++)pose=player.step({dt:1/60,active:true,onset:true})
  assert.equal(pose.switches,0)
  assert.equal(pose.weight,1)
  pose=player.step({dt:1/60,active:false});assert.ok(pose.weight>0&&pose.weight<1)
  for(let i=0;i<30;i++)pose=player.step({dt:1/60,active:false})
  assert.equal(pose.weight,0)
})

test('clip boundaries constrain every sample, even with a long overlap', async () => {
  const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs')
  const frames=[...Array.from({length:60},()=>constantPose(1)),...Array.from({length:60},()=>constantPose(-1))]
  const clips=[{id:'a',start:0,end:59},{id:'b',start:60,end:119}]
  const player=createFreestyleMotionPlayer(frames,{clips,segmentSeconds:.8,crossfadeSeconds:.6})
  assert.equal(player.bank.clips.length,2)
  for(let i=0;i<600;i++){
    const pose=player.step({dt:1/60,active:true,energy:.8})
    const clip=clips[pose.clip]
    assert.ok(pose.sourceFrame>=clip.start&&pose.sourceFrame<=clip.end)
    assert.ok(pose.rotations.leftUpperArm.every(Number.isFinite))
  }
  assert.throws(()=>createFreestyleMotionPlayer(frames,{clips:[{start:0,end:60},{start:60,end:119}]}),/boundaries/)
})

test('overlap keeps the outgoing dance moving instead of freezing at the cut', async () => {
  const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs')
  const frames=Array.from({length:600},(_,i)=>constantPose(i*.01))
  const player=createFreestyleMotionPlayer(frames,{segmentSeconds:.8,crossfadeSeconds:.4,smoothingSeconds:0})
  let previous,cut=false,post=0
  const angle=p=>2*Math.atan2(p.rotations.leftUpperArm[0],p.rotations.leftUpperArm[3])
  for(let i=0;i<140;i++){
    const pose=player.step({dt:1/120,active:true,bpm:120})
    if(pose.switches>0&&!cut)cut=true
    if(cut&&post++<2){assert.ok(Math.abs(angle(pose)-angle(previous))>.0005,'outgoing source velocity survives the start of the blend')}
    previous=pose
  }
  assert.ok(cut)
})

test('window selection rejects hand-only motion when coordinated body material exists', async () => {
  const {createFreestyleMotionPlayer}=await import('../src/motion/freestyle-motion.mjs')
  const frames=Array.from({length:600},(_,i)=>{
    const pose=constantPose(Math.sin(i*.3)*.4)
    const lower=i<300?0:Math.sin(i*.1)*.4
    pose.rotations.leftUpperLeg=[Math.sin(lower/2),0,0,Math.cos(lower/2)]
    return pose
  })
  const player=createFreestyleMotionPlayer(frames,{clips:[{id:'hands',start:0,end:299},{id:'body',start:300,end:599}],segmentSeconds:2})
  for(let i=0;i<600;i++)assert.equal(player.step({dt:1/60,active:true,energy:.5}).clip,1)
})
