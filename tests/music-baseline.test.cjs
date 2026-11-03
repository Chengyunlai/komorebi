const {test} = require('node:test')
const assert = require('node:assert/strict')

const load = async () => {
  const music = await import('../examples/stage-33-music-baseline/core/synthetic-music.mjs')
  const score = await import('../examples/stage-33-music-baseline/core/score.mjs')
  return {music, score}
}

const run = async (pcm, truth, sampleRate = 48000) => {
  const {score} = await load()
  return score.scoreAgainstTruth(score.analyzePcm(pcm, {sampleRate}), truth, {tolerance: .05})
}

test('stable drum patterns report BPM within 2% and match onsets', async () => {
  const {music} = await load()
  for (const bpm of [90, 120, 150]) {
    const seconds = 16
    const score = await run(music.drumsPattern({bpm, seconds}), music.truthFor({bpm, seconds}))
    assert.ok(score.tempo.medianBpm !== null, `${bpm}: tempo should be detected`)
    assert.ok(score.tempo.bpmError <= .02, `${bpm}: BPM error ${score.tempo.bpmError}`)
    assert.ok(score.onsets.recall >= .9, `${bpm}: onset recall ${score.onsets.recall}`)
    assert.ok(score.tempo.halfTimeFraction < .2, `${bpm}: must not lock onto half time`)
    assert.ok(score.tempo.doubleTimeFraction < .2, `${bpm}: must not lock onto double time`)
  }
})

test('half-beat ghost hits do not pull the tempo estimate down', async () => {
  const {music} = await load()
  const score = await run(music.ambiguousPattern({bpm: 120, seconds: 16, halfTime: true}), music.truthFor({bpm: 120, seconds: 16}))
  assert.ok(score.tempo.bpmError <= .03, `ambiguous pattern BPM error ${score.tempo.bpmError}`)
  assert.ok(score.tempo.halfTimeFraction < .2, 'half-time fraction should stay low')
})

test('dynamic song arc keeps tempo and reports tracking', async () => {
  const {music} = await load()
  const score = await run(music.segmentedPattern({bpm: 120, seconds: 24}), music.truthFor({bpm: 120, seconds: 24}))
  assert.ok(score.tempo.bpmError <= .02, `arc BPM error ${score.tempo.bpmError}`)
  assert.equal(score.finalState, 'tracking')
})

test('silent gap produces silent state and recovers to tracking', async () => {
  const {music} = await load()
  const pcm = music.withGap(music.drumsPattern({bpm: 120, seconds: 16}), {startSeconds: 6, gapSeconds: 3})
  const {score} = await load()
  const result = score.scoreAgainstTruth(score.analyzePcm(pcm, {sampleRate: 48000}), {bpm: 120, beatTimes: []}, {tolerance: .05})
  const states = score.analyzePcm(pcm, {sampleRate: 48000}).states.map(packet => ({time: packet.sampleFrame / 48000, state: packet.state}))
  const silent = states.find(change => change.state === 'silent' && change.time > 5 && change.time < 8)
  assert.ok(silent, 'silence should be reported inside the gap')
  const recovered = states.find(change => change.state === 'tracking' && change.time > 9)
  assert.ok(recovered, 'tracking should resume after the gap')
  assert.equal(result.finalState, 'tracking')
})

test('digital silence reports silent and no tempo', async () => {
  const {score} = await load()
  const result = score.scoreAgainstTruth(score.analyzePcm(new Float32Array(48000 * 3), {sampleRate: 48000}), {bpm: 120, beatTimes: []})
  assert.equal(result.finalState, 'silent')
  assert.equal(result.tempo.medianBpm, null)
  assert.equal(result.onsets.count, 0)
})
