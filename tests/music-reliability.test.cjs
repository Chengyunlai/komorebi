const {test} = require('node:test')
const assert = require('node:assert/strict')

function featureWindow({duration = 2, fps = 30, state = () => 'tracking', confidence = () => .7} = {}) {
  const samples = []
  for (let time = 0; time < duration; time += 1 / fps) samples.push({time, state: state(time), confidence: confidence(time)})
  return samples
}

test('locked tracking with decent confidence is reliable', async () => {
  const {judgeMusicReliability} = await import('../src/motion/music-reliability.mjs')
  const result = judgeMusicReliability(featureWindow())
  assert.equal(result.reliable, true)
  assert.equal(result.reason, 'tracking-locked')
  assert.ok(result.trackingRatio >= .5)
  assert.ok(result.confidenceMedian >= .55)
})

test('the Boom Boom Pow-style capture (low confidence, low tracking) is unreliable', async () => {
  const {judgeMusicReliability} = await import('../src/motion/music-reliability.mjs')
  // Measured in stage-33: confidence median 0.20, tracking fraction 0.099.
  const samples = featureWindow({state: time => (time % 1 < .1 ? 'tracking' : 'warming'), confidence: () => .2})
  const result = judgeMusicReliability(samples)
  assert.equal(result.reliable, false)
  assert.ok(['low-tracking', 'low-confidence'].includes(result.reason))
})

test('silence, sparse windows and short windows are all unreliable with explicit reasons', async () => {
  const {judgeMusicReliability} = await import('../src/motion/music-reliability.mjs')
  assert.equal(judgeMusicReliability([]).reason, 'insufficient-samples')
  assert.equal(judgeMusicReliability(featureWindow({duration: .2})).reason, 'insufficient-samples')
  const silent = judgeMusicReliability(featureWindow({state: () => 'silent', confidence: () => 0}))
  assert.equal(silent.reliable, false)
  assert.equal(silent.reason, 'silent')
})

test('gate keeps reactive mode until a reliable window holds for the hold duration', async () => {
  const {createReliabilityGate} = await import('../src/motion/music-reliability.mjs')
  const gate = createReliabilityGate({holdSeconds: .8})
  const good = {reliable: true, reason: 'tracking-locked'}
  const bad = {reliable: false, reason: 'low-tracking'}
  assert.equal(gate.push(bad, 0), 'reactive')
  assert.equal(gate.push(good, 1), 'reactive', 'hopped immediately')
  assert.equal(gate.push(good, 1.3), 'reactive', 'not yet held long enough')
  assert.equal(gate.push(good, 1.9), 'beat-aligned', 'held for 0.9s')
  assert.equal(gate.push(bad, 2), 'beat-aligned', 'demotion also needs hold')
  assert.equal(gate.push(bad, 2.9), 'reactive', 'demoted after hold')
  gate.reset()
  assert.equal(gate.mode, 'reactive')
})

test('monitor rolls its window and reports a judgement', async () => {
  const {createReliabilityMonitor} = await import('../src/motion/music-reliability.mjs')
  const monitor = createReliabilityMonitor()
  for (let time = 0; time < 3; time += 1 / 30) monitor.push({time, state: 'tracking', confidence: .7})
  const judgement = monitor.judge()
  assert.equal(judgement.reliable, true)
  assert.ok(monitor.snapshot().length > 0)
  monitor.clear()
  assert.equal(monitor.judge().reason, 'insufficient-samples')
})
