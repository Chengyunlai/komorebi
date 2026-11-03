import {MusicAnalyzer} from '../../../electron/vendor/music-signal/analyzer.mjs'

const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
}

/** Feed PCM through the host analyser exactly like the worker does, then score it. */
export function analyzePcm(pcm, {sampleRate = 48000, blockSize = 800, streamId = 'baseline'} = {}) {
  const analyzer = new MusicAnalyzer({sampleRate, featureHz: 30, streamId})
  const features = [], onsets = [], beats = [], states = []
  let frame = 0
  while (frame < pcm.length) {
    const count = Math.min(blockSize, pcm.length - frame)
    const packets = analyzer.push({mono: pcm.subarray(frame, frame + count), startFrame: frame})
    frame += count
    for (const packet of packets) {
      if (packet.type === 'features') features.push(packet)
      if (packet.type === 'onset') onsets.push(packet)
      if (packet.type === 'beat') beats.push(packet)
      if (packet.type === 'state') states.push(packet)
    }
  }
  return {features, onsets, beats, states, sampleRate}
}

function matchTimes(detected, truth, tolerance) {
  const unmatched = new Set(truth.map((_, i) => i))
  let matched = 0
  for (const time of detected) {
    let best = -1, bestDistance = Infinity
    for (const index of unmatched) {
      const distance = Math.abs(truth[index] - time)
      if (distance < bestDistance) { bestDistance = distance; best = index }
    }
    if (best >= 0 && bestDistance <= tolerance) { unmatched.delete(best); matched++ }
  }
  return {matched, missed: truth.length - matched, extra: detected.length - matched, recall: truth.length ? matched / truth.length : 0}
}

/**
 * Score a run against known truth. All numbers are diagnostics for the host analyser;
 * none of them is a musical-quality judgement.
 */
export function scoreAgainstTruth(run, truthRecords, {tolerance = .05, trackedAfterSeconds = 6} = {}) {
  const beatTimes = truthRecords.beatTimes ?? []
  const trueBpm = truthRecords.bpm
  const onsetTimes = run.onsets.map(packet => packet.sampleFrame / run.sampleRate)
  const onsetMatch = matchTimes(onsetTimes, beatTimes, tolerance)
  const beatEvents = run.beats.map(packet => packet.sampleFrame / run.sampleRate)
  const beatMatch = matchTimes(beatEvents, beatTimes, tolerance)
  const tempoSamples = run.features.map(packet => packet.tempo).filter(Boolean)
  const bpms = tempoSamples.filter(tempo => tempo.confidence >= .55).map(tempo => tempo.bpm)
  const medianBpm = median(bpms)
  const bpmError = medianBpm !== null ? Math.abs(medianBpm - trueBpm) / trueBpm : null
  const halfTime = bpms.length ? bpms.filter(bpm => Math.abs(bpm - trueBpm / 2) / trueBpm < .06).length / bpms.length : null
  const doubleTime = bpms.length ? bpms.filter(bpm => Math.abs(bpm - trueBpm * 2) / trueBpm < .06).length / bpms.length : null
  const stateChanges = run.states.map(packet => ({time: packet.sampleFrame / run.sampleRate, state: packet.state}))
  const firstTracking = stateChanges.find(change => change.state === 'tracking')
  const finalState = run.features.at(-1)?.state ?? null
  const lateTracking = firstTracking && firstTracking.time > trackedAfterSeconds
  return {
    trueBpm,
    durationSeconds: run.features.at(-1) ? run.features.at(-1).sampleFrame / run.sampleRate : 0,
    onsets: {...onsetMatch, count: onsetTimes.length},
    beats: {...beatMatch, count: beatEvents.length},
    tempo: {
      samples: bpms.length, medianBpm, bpmError,
      halfTimeFraction: halfTime, doubleTimeFraction: doubleTime,
      firstTrackingSeconds: firstTracking?.time ?? null, lateTracking,
    },
    states: stateChanges.map(change => `${change.time.toFixed(2)}s:${change.state}`),
    finalState,
  }
}
