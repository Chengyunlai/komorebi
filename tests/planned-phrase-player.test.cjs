const {test} = require('node:test')
const assert = require('node:assert/strict')

function framesFixture(count = 120) {
  return Array.from({length: count}, (_, i) => ({
    rotations: {
      hips: [0, 0, 0, 1],
      spine: [i / count, 0, 0, Math.sqrt(1 - (i / count) ** 2)],
    },
    hips: [0, .01 * i, 0],
    feet: {left: [.1, 0, .1 + .001 * i], right: [-.1, 0, -.1]},
  }))
}

function planFixture() {
  return {
    schema: 'dance-plan/v1',
    music: {bpm: 120, beatSeconds: .5, duration: 10},
    phrases: [
      {
        index: 0, startTime: 0, endTime: 5, startBeat: 0, endBeat: 10,
        musicMode: 'flow', musicEnergy: .5, timeScale: 2,
        source: {phraseIndex: 0, startTime: 0, endTime: 2.5, startSupport: 'left', endSupport: 'right', accentCount: 4, kind: 'candidate-group'},
        alignedAccents: 4, accentToBeatErrorMs: 80, repeatOf: null, sourceIndex: 0, reason: 'steady-flow',
      },
      {
        index: 1, startTime: 5, endTime: 10, startBeat: 10, endBeat: 20,
        musicMode: 'drive', musicEnergy: .8, timeScale: 1,
        source: {phraseIndex: 3, startTime: 10, endTime: 15, startSupport: 'right', endSupport: 'left', accentCount: 5, kind: 'candidate-group'},
        alignedAccents: 5, accentToBeatErrorMs: 60, repeatOf: null, sourceIndex: 3, reason: 'energy-rising-prefer-novel',
      },
    ],
    summary: {phraseCount: 2},
  }
}

test('maps music beats onto source time through the planned phrase and time scale', async () => {
  const {createPlannedPhrasePlayer} = await import('../src/motion/planned-phrase-player.mjs')
  const player = createPlannedPhrasePlayer(framesFixture(300), planFixture(), {fps: 15})
  // Music beat 4 = 2s -> phrase 0 source time = 0 + 2/2 = 1s -> frame 15
  const pose = player.step({dt: 1 / 30, active: true, beat: 4, clockEpoch: 1})
  assert.equal(pose.plan.phraseIndex, 0)
  assert.ok(Math.abs(pose.sourceFrame - 15) < 1e-6, `expected source frame 15, got ${pose.sourceFrame}`)
  assert.equal(pose.plan.timeScale, 2)
  assert.equal(pose.source.primitive, 'planned-phrase')
  assert.equal(pose.transitionPolicy, 'planned-phrases')
  // Music beat 12 = 6s -> phrase 1, source time = 10 + (6-5)/1 = 11s -> frame 165
  const second = player.step({dt: 1 / 30, active: true, beat: 12, clockEpoch: 1})
  assert.equal(second.plan.phraseIndex, 1)
  assert.ok(Math.abs(second.sourceFrame - 165) < 1e-6, `expected source frame 165, got ${second.sourceFrame}`)
  assert.equal(second.switches, 1)
  assert.ok(second.weight > 0)
})

test('clamps at the plan edges, fades out when inactive and resets on clock epochs', async () => {
  const {createPlannedPhrasePlayer} = await import('../src/motion/planned-phrase-player.mjs')
  const player = createPlannedPhrasePlayer(framesFixture(300), planFixture(), {fps: 15})
  let pose = player.step({dt: 1 / 30, active: true, beat: 0, clockEpoch: 1})
  assert.equal(pose.plan.phraseIndex, 0)
  pose = player.step({dt: 1 / 30, active: true, beat: 40, clockEpoch: 1})
  assert.equal(pose.plan.phraseIndex, 1)
  assert.ok(pose.plan.musicTime <= 10, 'music time clamps to the plan end')
  // inactive: weight decays to zero and source mode reports waiting
  for (let i = 0; i < 30; i++) pose = player.step({dt: 1 / 30, active: false, beat: 40, clockEpoch: 1})
  assert.equal(pose.weight, 0)
  assert.equal(pose.source.mode, 'waiting')
  // re-activation restarts phrase tracking
  pose = player.step({dt: 1 / 30, active: true, beat: 0, clockEpoch: 2})
  assert.equal(pose.plan.phraseIndex, 0)
  assert.equal(pose.switches, 0)
})

test('transitions use one fixed duration so the rhythm stays consistent', async () => {
  const {createPlannedPhrasePlayer} = await import('../src/motion/planned-phrase-player.mjs')
  const still = Array.from({length: 300}, () => ({rotations: {hips: [0, 0, 0, 1], spine: [0, 0, 0, 1]}, hips: [0, 0, 0], feet: {left: [.1, 0, .1], right: [-.1, 0, -.1]}}))
  const jumpy = Array.from({length: 300}, (_, i) => {
    const turn = i < 100 ? 0 : 2.2
    return {rotations: {hips: [Math.sin(turn / 2), 0, 0, Math.cos(turn / 2)], spine: [0, 0, 0, 1]}, hips: [0, 0, 0], feet: {left: [.1, 0, .1], right: [-.1, 0, -.1]}}
  })
  for (const frames of [still, jumpy]) {
    const player = createPlannedPhrasePlayer(frames, planFixture(), {fps: 15, transitionSeconds: .45})
    player.step({dt: 1 / 30, active: true, beat: 9.9, clockEpoch: 1})
    const pose = player.step({dt: 1 / 30, active: true, beat: 10.1, clockEpoch: 1})
    assert.equal(pose.plan.transition.seconds, .45, 'all switches share the same blend duration')
    assert.equal(pose.plan.transition.active, true)
  }
})

test('invalid plans and frames are rejected', async () => {
  const {createPlannedPhrasePlayer} = await import('../src/motion/planned-phrase-player.mjs')
  assert.throws(() => createPlannedPhrasePlayer([], planFixture()), TypeError)
  assert.throws(() => createPlannedPhrasePlayer(framesFixture(), {phrases: []}), TypeError)
  assert.throws(() => createPlannedPhrasePlayer(framesFixture(), {phrases: [{startTime: 0, endTime: 1}], music: {}}), TypeError)
})
