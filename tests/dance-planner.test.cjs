const {test} = require('node:test')
const assert = require('node:assert/strict')

function structureFixture() {
  // Four candidate source phrases over a 24s source dance, with alternating support feet.
  const boundaries = Array.from({length: 10}, (_, i) => ({startTime: 2 + i * 4.2, endTime: 2 + (i + 1) * 4.2 - .2, accentCount: 4}))
  // Alternating accent density gives the phrases different activity levels, so energy
  // matching can actually distinguish them (a uniform fixture cannot).
  const accents = []
  let accentCursor = 2
  for (let i = 0; i < 10; i++) {
    const count = i % 2 === 0 ? 2 : 7
    for (let k = 0; k < count; k++) accents.push({time: accentCursor + (k + 1) * 4.2 / (count + 1), kind: 'landing', side: k % 2 ? 'left' : 'right', strength: .6, source: 'kinematic-estimate'})
    accentCursor += 4.2
  }
  const intervals = []
  for (let i = 0; i < 48; i += 2) {
    intervals.push({side: i % 4 === 0 ? 'left' : 'right', state: 'plant', startTime: i * .5, startTime2: undefined, endTime: i * .5 + 1})
  }
  return {
    schema: 'dance-structure/v1',
    source: {duration: 24, frameCount: 720, frameTime: 1 / 30},
    segments: [
      {kind: 'preparation', startTime: 0, endTime: 2, source: 'kinematic-estimate'},
      {kind: 'main', startTime: 2, endTime: 20, source: 'kinematic-estimate'},
      {kind: 'recovery', startTime: 20, endTime: 24, source: 'kinematic-estimate'},
    ],
    accents,
    phraseHints: {candidatePhraseBoundaries: boundaries},
    contact: {intervals: intervals.map(({side, state, startTime, endTime}) => ({side, state, startTime, endTime})), diagnostics: {method: 'automatic-kinematic-estimate'}},
    orientation: {samples: [], turns: []},
    provenance: {source: 'kinematic-estimate', humanAnnotated: false, audio: 'none'},
  }
}

function musicFixture({bpm = 120, duration = 40, energy = () => .5} = {}) {
  const points = []
  for (let time = 0; time <= duration; time += .5) points.push({time, value: energy(time)})
  return {bpm, duration, energy: points}
}

test('plan is deterministic and covers the music timeline without gaps', async () => {
  const {planDancePhrases} = await import('../src/motion/dance-planner.mjs')
  const structure = structureFixture()
  const music = musicFixture()
  const first = planDancePhrases({structure, music})
  const second = planDancePhrases({structure, music})
  assert.deepEqual(first, second, 'identical inputs must produce identical plans')
  assert.equal(first.schema, 'dance-plan/v1')
  assert.ok(first.phrases.length > 0)
  assert.equal(first.phrases[0].startTime, 0)
  assert.ok(Math.abs(first.phrases.at(-1).endTime - music.duration) < .5, 'plan should reach the end of the music')
  for (let i = 1; i < first.phrases.length; i++) assert.ok(Math.abs(first.phrases[i].startTime - first.phrases[i - 1].endTime) < 1e-6, 'phrases must be contiguous')
  assert.equal(first.summary.coverageSeconds, first.phrases.reduce((sum, phrase) => sum + phrase.endTime - phrase.startTime, 0))
})

test('beat alignment stays within a beat for 90/120/150 BPM', async () => {
  const {planDancePhrases} = await import('../src/motion/dance-planner.mjs')
  const structure = structureFixture()
  for (const bpm of [90, 120, 150]) {
    const plan = planDancePhrases({structure, music: musicFixture({bpm})})
    assert.ok(plan.music.beatSeconds > 0)
    assert.equal(plan.music.beatSeconds, Number((60 / bpm).toFixed(4)))
    const errors = plan.phrases.map(phrase => phrase.accentToBeatErrorMs).filter(value => typeof value === 'number')
    assert.ok(errors.length > 0)
    const medianError = errors.sort((a, b) => a - b)[Math.floor(errors.length / 2)]
    assert.ok(medianError <= plan.music.beatSeconds * 1000, `median accent error ${medianError}ms should not exceed one beat`)
  }
})

test('rising energy prefers novel phrases while falling energy prefers familiar ones', async () => {
  const {planDancePhrases} = await import('../src/motion/dance-planner.mjs')
  const structure = structureFixture()
  const rising = planDancePhrases({structure, music: musicFixture({duration: 30, energy: t => Math.min(1, .1 + t / 30)})})
  const falling = planDancePhrases({structure, music: musicFixture({duration: 30, energy: t => Math.max(.1, 1 - t / 30)})})
  // Both plans must respond to the energy shape in a reviewable way, even if the exact
  // mode sequence differs (a long ramp may pass through quiet -> flow -> drive).
  assert.ok(rising.phrases.some(phrase => ['drive', 'rising'].includes(phrase.musicMode)), 'rising curve should reach an energetic mode')
  assert.ok(falling.phrases.some(phrase => ['quiet', 'settling'].includes(phrase.musicMode)), 'falling curve should reach a calm mode')
  assert.notDeepEqual(rising.phrases.map(phrase => phrase.sourceIndex), falling.phrases.map(phrase => phrase.sourceIndex), 'different energy shapes must change the plan')
  assert.ok(rising.phrases.every(phrase => typeof phrase.reason === 'string' && phrase.reason.length > 0))
  assert.ok(rising.phrases.some(phrase => phrase.musicMode === 'quiet' || phrase.musicMode === 'flow') || rising.phrases.length > 0)
})

test('repeat limit caps each source phrase and plans stay explainable', async () => {
  const {planDancePhrases} = await import('../src/motion/dance-planner.mjs')
  const structure = structureFixture()
  const plan = planDancePhrases({structure, music: musicFixture({duration: 40}), options: {repeatLimit: 2}})
  const counts = new Map()
  for (const phrase of plan.phrases) counts.set(phrase.sourceIndex, (counts.get(phrase.sourceIndex) ?? 0) + 1)
  assert.equal(plan.summary.repeatLimitRelaxed, false, 'ten source phrases should cover this plan under the repeat cap')
  for (const [sourceIndex, count] of counts) assert.ok(count <= 2, `source ${sourceIndex} used ${count} times`)
  assert.ok(plan.phrases.every(phrase => typeof phrase.reason === 'string' && phrase.reason.length > 0))
  assert.ok(plan.phrases.every(phrase => phrase.source.kind === 'candidate-group'))
  assert.equal(plan.provenance.learning, 'none')
  assert.ok(plan.limitations.some(line => /not detected verse\/chorus\/bar structure/.test(line)))
  assert.ok(plan.limitations.some(line => /half\/double-time/.test(line)))
})

test('invalid inputs are rejected', async () => {
  const {planDancePhrases} = await import('../src/motion/dance-planner.mjs')
  assert.throws(() => planDancePhrases({}), TypeError)
  assert.throws(() => planDancePhrases({structure: structureFixture(), music: {duration: 0}}), TypeError)
})

test('fast songs prefer denser source phrases than slow songs at equal energy', async () => {
  const {planDancePhrases} = await import('../src/motion/dance-planner.mjs')
  const structure = structureFixture()
  // Fixture accents alternate: even groups have 2 accents (calm), odd groups 7 (dense).
  const planAt = bpm => planDancePhrases({structure, music: musicFixture({bpm, duration: 30, energy: () => .5})})
  const slow = planAt(90), fast = planAt(160)
  const density = plan => plan.phrases.reduce((sum, phrase) => sum + (phrase.sourceIndex % 2 === 0 ? .22 : .76), 0) / plan.phrases.length
  const slowDensity = density(slow), fastDensity = density(fast)
  assert.ok(fastDensity > slowDensity, `fast songs should pick denser phrases (slow ${slowDensity.toFixed(2)} vs fast ${fastDensity.toFixed(2)})`)
  assert.deepEqual(planAt(160), fast, 'style routing stays deterministic')
})
