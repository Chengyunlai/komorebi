const test = require('node:test')
const assert = require('node:assert/strict')
const {createContinuousGroove} = require('../src/motion/continuous-groove.mjs')

const run = (steps, {energy = .6} = {}) => {
  const groove = createContinuousGroove({seed: 3})
  const poses = []
  for (let i = 0; i < steps; i++) {
    poses.push(groove.step({dt: 1 / 30, energy, beat: i * 2 / 30, onset: i % 15 === 0, accent: .7, bands: {low: .45, mid: .3, high: .2}}))
  }
  return poses
}

test('groove outputs a full continuous pose without any discrete selection', () => {
  const groove = createContinuousGroove()
  const pose = groove.step({dt: 1 / 30, energy: .6, beat: .25, onset: true, accent: .6, bands: {low: .4, mid: .3, high: .2}})
  assert.equal(Object.keys(pose.rotations).length, 20)
  assert.ok(Number.isFinite(pose.hips[1]) && pose.hips[1] <= 0)
  assert.ok(pose.feet.left && pose.feet.right)
  assert.ok(pose.weight > 0 && pose.weight <= 1)
})

test('higher energy produces deeper knee bounce and more arm motion', () => {
  const quiet = run(90, {energy: .2})
  const loud = run(90, {energy: .95})
  const knee = poses => Math.max(...poses.map(p => Math.abs(p.rotations.leftUpperLeg[0])))
  const arm = poses => Math.max(...poses.map(p => Math.abs(p.rotations.leftUpperArm[2] + 1.16)))
  assert.ok(knee(loud) > knee(quiet), `knee loud ${knee(loud)} vs quiet ${knee(quiet)}`)
  assert.ok(arm(loud) > arm(quiet), `arm loud ${arm(loud)} vs quiet ${arm(quiet)}`)
})

test('poses change smoothly frame to frame (no segment snapping)', () => {
  const poses = run(120)
  let worst = 0
  for (let i = 1; i < poses.length; i++) {
    for (const [bone, angles] of Object.entries(poses[i].rotations)) {
      const previous = poses[i - 1].rotations[bone]
      for (let axis = 0; axis < 3; axis++) worst = Math.max(worst, Math.abs(angles[axis] - previous[axis]))
    }
  }
  assert.ok(worst < .40, `largest per-frame joint change ${worst.toFixed(3)} rad`)
})

test('onset accents add a transient impulse that decays back', () => {
  const groove = createContinuousGroove({seed: 5})
  let peak = 0
  for (let i = 0; i < 12; i++) {
    const pose = groove.step({dt: 1 / 30, energy: .6, beat: .1, onset: i === 0, accent: 1, bands: {low: .3, mid: .3, high: .1}})
    peak = Math.max(peak, Math.abs(pose.rotations.leftUpperLeg[0]))
  }
  const idle = groove.step({dt: 1 / 30, energy: .6, beat: .2, onset: false, accent: 0})
  assert.ok(peak > .15, `accent impulse ${peak}`)
  assert.ok(Math.abs(idle.rotations.leftUpperLeg[0]) < peak)
})

test('resting music settles into a calm pose', () => {
  const groove = createContinuousGroove({seed: 9})
  let pose
  for (let i = 0; i < 120; i++) pose = groove.step({dt: 1 / 30, active: false, energy: .1, beat: .5})
  assert.ok(pose.weight < .2, `weight ${pose.weight}`)
  assert.ok(Math.abs(pose.rotations.leftUpperLeg[0]) < .60, 'knees relax')
})
