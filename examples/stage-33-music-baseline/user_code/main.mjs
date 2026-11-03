import {drumsPattern, ambiguousPattern, segmentedPattern, withGap, truthFor} from '../core/synthetic-music.mjs'
import {analyzePcm, scoreAgainstTruth} from '../core/score.mjs'
import {planDancePhrases} from '../../../src/motion/dance-planner.mjs'

const sampleRate = 48000
const cases = []

function runCase({name, pcm, truth, note}) {
  const run = analyzePcm(pcm, {sampleRate})
  const score = scoreAgainstTruth(run, truth, {tolerance: .05})
  cases.push({name, note, truth: {bpm: truth.bpm, beats: truth.beatTimes.length}, score})
}

// 1) Stable four-on-the-floor at three tempos.
for (const bpm of [90, 120, 150]) {
  const seconds = 16
  runCase({name: `stable-${bpm}`, pcm: drumsPattern({bpm, seconds, sampleRate}), truth: truthFor({bpm, seconds}), note: 'four-on-floor, eighth hats'})
}

// 2) Half-time trap: ghost hats on the half-beat, strong kick every four beats.
runCase({name: 'ambiguous-half', pcm: ambiguousPattern({bpm: 120, seconds: 16, sampleRate, halfTime: true}), truth: truthFor({bpm: 120, seconds: 16}), note: 'half-beat ghost hits may pull the tempo estimate down'})

// 3) Segmented dynamics (song arc).
runCase({name: 'segmented-arc', pcm: segmentedPattern({bpm: 120, seconds: 24, sampleRate}), truth: truthFor({bpm: 120, seconds: 24}), note: 'quiet intro / build / body / outro'})

// 4) Silent gap: analyser must report silent and recover.
const gapped = withGap(drumsPattern({bpm: 120, seconds: 16, sampleRate}), {startSeconds: 6, gapSeconds: 3, sampleRate})
const gapTruth = (() => {
  const beatSeconds = 60 / 120, times = []
  for (let t = 0; t < 6; t += beatSeconds) times.push(t)
  for (let t = 9; t < 16; t += beatSeconds) times.push(t)
  return {bpm: 120, beatTimes: times}
})()
runCase({name: 'silent-gap', pcm: gapped, truth: gapTruth, note: '3s silence inserted at 6s; truth times shifted after the gap'})

// 5) Digital silence only.
runCase({name: 'silence', pcm: new Float32Array(sampleRate * 3), truth: {bpm: 120, beatTimes: []}, note: 'no signal at all'})

// End-to-end: real analyser features from the segmented arc drive a planner over a small
// known structure fixture. This checks the signal -> plan wiring, not dance quality.
const arcRun = analyzePcm(segmentedPattern({bpm: 120, seconds: 24, sampleRate}), {sampleRate})
const arcEnergy = []
let arcLast = -1
for (const feature of arcRun.features) {
  const time = feature.sampleFrame / sampleRate
  if (time - arcLast >= .5) { arcEnergy.push({time: Number(time.toFixed(2)), value: Number(feature.energy.toFixed(3))}); arcLast = time }
}
const planBpm = (() => {
  const bpms = arcRun.features.map(feature => feature.tempo).filter(tempo => tempo && tempo.confidence >= .55).map(tempo => tempo.bpm).sort((a, b) => a - b)
  return bpms.length ? Math.round(bpms[Math.floor(bpms.length / 2)]) : 120
})()
const fixtureStructure = {
  schema: 'dance-structure/v1',
  source: {duration: 40, frameCount: 600, frameTime: 1 / 15},
  segments: [{kind: 'preparation', startTime: 0, endTime: 4}, {kind: 'main', startTime: 4, endTime: 36}, {kind: 'recovery', startTime: 36, endTime: 40}],
  accents: Array.from({length: 40}, (_, i) => ({time: 4 + i * .8, kind: 'landing', side: i % 2 ? 'left' : 'right', strength: .6, source: 'kinematic-estimate'})),
  phraseHints: {candidatePhraseBoundaries: Array.from({length: 10}, (_, i) => ({startTime: 4 + i * 3.2, endTime: 4 + (i + 1) * 3.2 - .2, accentCount: 4}))},
  contact: {intervals: []}, orientation: {samples: [], turns: []},
  provenance: {source: 'kinematic-estimate', humanAnnotated: false, audio: 'none'},
}
const endToEndPlan = planDancePhrases({structure: fixtureStructure, music: {bpm: planBpm, duration: 24, energy: arcEnergy}})

const summary = cases.map(({name, truth, score}) => ({
  name,
  truth,
  onsets: `${score.onsets.matched}/${truth.beats} matched, ${score.onsets.extra} extra`,
  tempo: score.tempo.medianBpm === null ? 'n/a' : `${score.tempo.medianBpm.toFixed(1)} BPM (error ${(score.tempo.bpmError * 100).toFixed(1)}%)`,
  halfTime: score.tempo.halfTimeFraction, doubleTime: score.tempo.doubleTimeFraction,
  firstTracking: score.tempo.firstTrackingSeconds, finalState: score.finalState,
  states: score.states,
}))
const endToEnd = { detectedBpm: planBpm, phrases: endToEndPlan.summary.phraseCount, uniqueSources: endToEndPlan.summary.uniqueSources, planEndSeconds: endToEndPlan.summary.planEndSeconds, medianAccentErrorMs: endToEndPlan.summary.medianAccentToBeatErrorMs }
console.log(JSON.stringify({schema: 'music-baseline/v1', sampleRate, cases, summary, endToEnd}, null, 2))
