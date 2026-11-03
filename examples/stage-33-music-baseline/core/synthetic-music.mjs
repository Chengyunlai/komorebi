/**
 * Deterministic synthetic music for MUSIC-01 baselines.
 * Known-truth drum patterns: no commercial audio, no network, reproducible PCM.
 * The generator only writes samples; all scoring happens in score.mjs.
 */

const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v))

function addKick(out, start, sampleRate, amp) {
  const length = Math.floor(sampleRate * .12)
  for (let i = 0; i < length && start + i < out.length; i++) {
    const t = i / sampleRate
    const envelope = Math.exp(-t * 28)
    const body = Math.sin(2 * Math.PI * (95 - 45 * Math.min(1, t / .08)) * t)
    out[start + i] += body * envelope * amp
  }
}

function addSnare(out, start, sampleRate, amp) {
  const length = Math.floor(sampleRate * .08)
  let seed = 12345
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1 }
  for (let i = 0; i < length && start + i < out.length; i++) {
    const t = i / sampleRate
    const envelope = Math.exp(-t * 45)
    const noise = random() * .6 + Math.sin(2 * Math.PI * 190 * t) * .4
    out[start + i] += noise * envelope * amp
  }
}

function addHat(out, start, sampleRate, amp, length = .03) {
  const count = Math.floor(sampleRate * length)
  let seed = 777
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1 }
  for (let i = 0; i < count && start + i < out.length; i++) {
    const t = i / sampleRate
    out[start + i] += random() * Math.exp(-t * 120) * amp
  }
}

/**
 * Four-on-the-floor with backbeat snare and eighth-note hats.
 * `energy` scales the whole pattern (segment dynamics), `subdivision` adds off-beat hats.
 */
export function drumsPattern({bpm = 120, seconds = 12, sampleRate = 48000, energy = () => 1, subdivision = 2} = {}) {
  if (!(bpm > 0) || !(seconds > 0) || !(sampleRate >= 8000)) throw new TypeError('Invalid drum pattern parameters')
  const out = new Float32Array(Math.floor(seconds * sampleRate))
  const beatSeconds = 60 / bpm
  const beats = Math.floor(seconds / beatSeconds)
  for (let beat = 0; beat < beats; beat++) {
    const time = beat * beatSeconds
    const level = clamp(energy(time), 0, 1)
    const kickAt = Math.floor(time * sampleRate)
    addKick(out, kickAt, sampleRate, .85 * level)
    if (beat % 2 === 1) addSnare(out, kickAt, sampleRate, .5 * level)
    for (let sub = 0; sub < subdivision; sub++) {
      const hatAt = Math.floor((time + sub * beatSeconds / subdivision) * sampleRate)
      addHat(out, hatAt, sampleRate, (sub === 0 ? .18 : .12) * level)
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = clamp(out[i])
  return out
}

/** Pattern where every second beat is a subdivided ghost beat: an analyser may lock onto 2x/0.5x. */
export function ambiguousPattern({bpm = 120, seconds = 12, sampleRate = 48000, halfTime = true} = {}) {
  const out = new Float32Array(Math.floor(seconds * sampleRate))
  const beatSeconds = 60 / bpm
  const beats = Math.floor(seconds / beatSeconds)
  for (let beat = 0; beat < beats; beat++) {
    const time = beat * beatSeconds
    const strong = beat % 4 === 0
    addKick(out, Math.floor(time * sampleRate), sampleRate, strong ? .9 : .35)
    addHat(out, Math.floor((time + beatSeconds * .5) * sampleRate), sampleRate, halfTime ? .5 : .12)
  }
  for (let i = 0; i < out.length; i++) out[i] = clamp(out[i])
  return out
}

/** Segmented energy: quiet intro, build, loud body, quiet outro (simulates a song arc). */
export function segmentedPattern({bpm = 120, seconds = 24, sampleRate = 48000} = {}) {
  const energy = time => {
    const section = time / seconds
    if (section < .25) return .25
    if (section < .5) return .25 + (section - .25) * 2.4
    if (section < .8) return .9
    return Math.max(.15, .9 - (section - .8) * 5)
  }
  return drumsPattern({bpm, seconds, sampleRate, energy})
}

/** Concatenate a gap of silence to test silent/lost state and recovery. */
export function withGap(pattern, {startSeconds, gapSeconds, sampleRate = 48000} = {}) {
  const start = Math.floor(startSeconds * sampleRate), gap = Math.floor(gapSeconds * sampleRate)
  const out = new Float32Array(pattern.length + gap)
  out.set(pattern.subarray(0, start), 0)
  out.set(pattern.subarray(start), start + gap)
  return out
}

export const truthFor = ({bpm, seconds}) => ({
  bpm,
  durationSeconds: seconds,
  beatTimes: Array.from({length: Math.floor(seconds / (60 / bpm))}, (_, i) => i * 60 / bpm),
})
