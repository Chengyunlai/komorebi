const {test} = require('node:test')
const assert = require('node:assert/strict')

function makeMaterial({frameCount = 60, fps = 30} = {}) {
  const rig = [
    {id: 'hips', name: 'Hips', parent: null},
    {id: 'spine', name: 'Spine', parent: 'hips'},
    {id: 'legL', name: 'UpperLeg_L', parent: 'hips'},
    {id: 'legR', name: 'UpperLeg_R', parent: 'hips'},
    {id: 'footL', name: 'Foot_L', parent: 'legL'},
    {id: 'footR', name: 'Foot_R', parent: 'legR'},
  ]
  const frames = Array.from({length: frameCount}, (_, i) => {
    const time = i / fps
    const active = i >= 15 && i < 45
    const yaw = Math.sin(time * 3) * .8
    const feet = {
      left: [Math.sin(yaw) * .1, i === 30 ? .25 : 0, Math.cos(yaw) * .1],
      right: [-Math.sin(yaw) * .1, 0, -Math.cos(yaw) * .1],
    }
    const angular = active ? .8 : .02
    return {
      frame: i, time,
      joints: {hips: {angularVelocity: [0, angular, 0]}, spine: {angularVelocity: [angular, 0, 0]}, legL: {angularVelocity: [0, angular, 0]}, legR: {angularVelocity: [angular, 0, 0]}, footL: {angularVelocity: [0, 0, 0]}, footR: {angularVelocity: [0, 0, 0]}},
      worldPositions: {
        hips: [0, .9, 0], spine: [0, 1.1, 0],
        legL: [Math.sin(yaw) * .12, .9, Math.cos(yaw) * .12], legR: [-Math.sin(yaw) * .12, .9, -Math.cos(yaw) * .12],
        footL: feet.left, footR: feet.right,
      },
      root: {linearVelocity: active ? [Math.cos(time) * .2, 0, 0] : [0, 0, 0]},
    }
  })
  return {schema: 'source-motion-material/v1', sourceId: 'synthetic', metersPerUnit: .01, rig, frames, range: {start: 0, end: frames.at(-1).time, duration: frames.at(-1).time}}
}

test('structure annotation separates preparation, main and recovery with explicit estimate provenance', async () => {
  const {annotateDanceStructure} = await import('../src/motion/dance-structure.mjs')
  const material = makeMaterial()
  const result = annotateDanceStructure(material, {fps: 30})
  assert.equal(result.schema, 'dance-structure/v1')
  assert.equal(result.provenance.source, 'kinematic-estimate')
  assert.equal(result.provenance.humanAnnotated, false)
  assert.equal(result.provenance.audio, 'none')
  const kinds = result.segments.map(segment => segment.kind)
  assert.deepEqual(kinds, ['preparation', 'main', 'recovery'])
  const [prep, main, recovery] = result.segments
  assert.equal(prep.start, 0)
  assert.ok(prep.end <= 16, 'preparation should end near the active onset')
  assert.ok(main.start > 10 && main.end < 50, 'main should cover the active middle')
  assert.equal(recovery.end, 59)
  for (const segment of result.segments) assert.equal(segment.source, 'kinematic-estimate')
  assert.ok(result.segments.every(s => s.endTime >= s.startTime))
})

test('accents, contact intervals and orientation carry kinematic-only evidence', async () => {
  const {annotateDanceStructure} = await import('../src/motion/dance-structure.mjs')
  const result = annotateDanceStructure(makeMaterial(), {fps: 30})
  assert.ok(result.accents.length > 0, 'should anchor motion peaks and landings')
  assert.ok(result.accents.every(a => a.source === 'kinematic-estimate'))
  assert.ok(result.accents.every((a, i) => i === 0 || a.frame >= result.accents[i - 1].frame), 'accents sorted by frame')
  assert.ok(result.accents.some(a => a.kind === 'landing'), 'the raised-foot sample should yield a landing anchor')
  assert.equal(result.contact.diagnostics.method, 'automatic-kinematic-estimate')
  assert.equal(result.contact.diagnostics.humanAnnotated, false)
  const states = new Set(result.contact.intervals.map(interval => interval.state))
  assert.ok(states.has('plant') && states.has('airborne'), 'contact intervals should contain plant and airborne states')
  assert.ok(result.contact.intervals.every(interval => interval.end >= interval.start))
  assert.ok(result.orientation.samples.length > 0)
  assert.ok(result.orientation.samples.every(sample => Number.isFinite(sample.yawDegrees)))
  assert.ok(result.orientation.turns.length > 0, 'oscillating hips should register turns')
  assert.ok(result.orientation.turns.every(turn => turn.source === 'kinematic-estimate'))
})

test('phrase hints are motion-rhythm hints and never claim song tempo', async () => {
  const {annotateDanceStructure} = await import('../src/motion/dance-structure.mjs')
  const result = annotateDanceStructure(makeMaterial(), {fps: 30})
  assert.ok(result.phraseHints.mainAccentCount >= 0)
  assert.match(result.phraseHints.note, /not a detected song tempo/)
  assert.ok(result.limitations.some(line => /not song beats/.test(line)))
  assert.ok(result.limitations.some(line => /not weight, force or human annotation/.test(line)))
})

test('supplied phases are preserved and invalid input is rejected', async () => {
  const {annotateDanceStructure} = await import('../src/motion/dance-structure.mjs')
  const material = makeMaterial()
  const phased = annotateDanceStructure(material, {fps: 30, phases: [{kind: 'main', start: 0, end: 59}]})
  assert.equal(phased.segments.length, 1)
  assert.equal(phased.segments[0].source, 'supplied')
  assert.throws(() => annotateDanceStructure(null), TypeError)
  assert.throws(() => annotateDanceStructure(material, {fps: 0}), TypeError)
})
