/**
 * Music-signal reliability gate.
 *
 * The host analyser is heuristic: on some real songs its tempo/beat output locks onto
 * subdivisions and loses tracking. This gate decides, from a short window of feature
 * samples, whether beat-aligned planning is trustworthy or the dancer should fall back
 * to onset/energy-reactive motion. It never fixes the signal; it only routes around it.
 */

const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length - 1] + sorted[0]) / 2
}

export const RELIABILITY_DEFAULTS = {
  windowSeconds: 2,
  minSamples: 20,
  minTrackingRatio: .5,
  minConfidence: .55,
  holdSeconds: .8,
}

/**
 * @param {{time:number, state?:string, confidence?:number, bpm?:number}[]} samples
 *        Feature samples newest-last; `time` in seconds since capture start.
 * @param {object} options
 * @returns {{reliable:boolean, reason:string, trackingRatio:number|null, confidenceMedian:number|null, samples:number}}
 */
export function judgeMusicReliability(samples, options = {}) {
  const config = {...RELIABILITY_DEFAULTS, ...options}
  const window = (samples ?? []).filter(sample => Number.isFinite(sample?.time))
  if (window.length < config.minSamples) {
    return {reliable: false, reason: 'insufficient-samples', trackingRatio: null, confidenceMedian: null, samples: window.length}
  }
  const newest = window[window.length - 1].time
  const recent = window.filter(sample => newest - sample.time <= config.windowSeconds)
  if (recent.length < config.minSamples) {
    return {reliable: false, reason: 'window-too-sparse', trackingRatio: null, confidenceMedian: null, samples: recent.length}
  }
  const tracking = recent.filter(sample => sample.state === 'tracking').length / recent.length
  const confidences = recent.map(sample => sample.confidence).filter(value => Number.isFinite(value))
  const confidenceMedian = confidences.length ? median(confidences) : null
  const silent = recent.every(sample => sample.state === 'silent')
  if (silent) return {reliable: false, reason: 'silent', trackingRatio: tracking, confidenceMedian, samples: recent.length}
  if (tracking < config.minTrackingRatio) return {reliable: false, reason: 'low-tracking', trackingRatio: tracking, confidenceMedian, samples: recent.length}
  if (confidenceMedian === null || confidenceMedian < config.minConfidence) return {reliable: false, reason: 'low-confidence', trackingRatio: tracking, confidenceMedian, samples: recent.length}
  return {reliable: true, reason: 'tracking-locked', trackingRatio: tracking, confidenceMedian, samples: recent.length}
}

/**
 * Gate state machine with hysteresis: mode changes only after the new judgement has held
 * for `holdSeconds`, so frame-to-frame chatter cannot flip the dancer between modes.
 * Modes: 'beat-aligned' (use the planned phrases) or 'reactive' (onset/energy-driven).
 */
export function createReliabilityGate(options = {}) {
  const config = {...RELIABILITY_DEFAULTS, ...options}
  let mode = 'reactive', pending = null, pendingSince = null
  return {
    get mode() { return mode },
    push(judgement, nowSeconds) {
      const next = judgement?.reliable ? 'beat-aligned' : 'reactive'
      if (next === mode) { pending = null; pendingSince = null; return mode }
      if (pending !== next) { pending = next; pendingSince = nowSeconds }
      if (pendingSince !== null && nowSeconds - pendingSince >= config.holdSeconds) {
        mode = next
        pending = null
        pendingSince = null
      }
      return mode
    },
    reset() { mode = 'reactive'; pending = null; pendingSince = null },
  }
}

/** Convenience: keep a rolling window of feature samples and judge it. */
export function createReliabilityMonitor(options = {}) {
  const config = {...RELIABILITY_DEFAULTS, ...options}
  const samples = []
  return {
    push({time, state, confidence, bpm}) {
      samples.push({time, state, confidence, bpm})
      while (samples.length && time - samples[0].time > config.windowSeconds * 2) samples.shift()
    },
    judge() { return judgeMusicReliability(samples, config) },
    snapshot() { return samples.slice() },
    clear() { samples.length = 0 },
  }
}
