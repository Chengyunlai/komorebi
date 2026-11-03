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
  assert.equal(pose.weight, 1)
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

test('higher music energy selects more active segments than quiet music', async () => {
  const {createFreestyleMotionPlayer} = await import('../src/motion/freestyle-motion.mjs')
  const frames = Array.from({length: 600}, (_, i) => {
    // The first half is calm (tiny rotation), the second half is active (large rotation).
    const amp = i < 300 ? .05 : 1.2
    const value = Math.sin(i / 8) * amp
    return {
      rotations: {hips: [0, 0, 0, 1], leftUpperArm: [value, 0, 0, Math.sqrt(Math.max(0, 1 - value ** 2))]},
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
