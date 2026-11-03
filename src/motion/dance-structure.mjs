import {analyzeFootContacts} from './contact-analysis.mjs'

const SIDES = ['left', 'right']
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
}
const smooth = (values, radius) => values.map((_, i) => {
  let sum = 0, count = 0
  for (let k = Math.max(0, i - radius); k <= Math.min(values.length - 1, i + radius); k++) { sum += values[k]; count++ }
  return count ? sum / count : 0
})

function jointIdByName(material, name) {
  return material.rig.find(joint => joint.name === name)?.id ?? null
}

/** Per-frame kinematic activity from joint angular velocity plus root linear velocity. */
function activityEnvelope(material) {
  const joints = material.rig.filter(joint => joint.parent !== null)
  const perFrame = material.frames.map(frame => {
    const angular = joints.length
      ? Math.sqrt(joints.reduce((sum, joint) => {
        const v = frame.joints[joint.id]?.angularVelocity
        return sum + (v ? v[0] * v[0] + v[1] * v[1] + v[2] * v[2] : 0)
      }, 0) / joints.length)
      : 0
    const root = frame.root?.linearVelocity
    const linear = root ? Math.hypot(root[0], root[2]) : 0
    return { time: frame.time, frame: frame.frame, angular, linear, activity: angular + linear * 1.5 }
  })
  const radius = 3
  const smoothed = smooth(perFrame.map(p => p.activity), radius)
  return { perFrame, smoothed }
}

/** Body facing yaw in the source horizontal plane, from the hip-width axis. */
function orientationSeries(material) {
  const legL = jointIdByName(material, 'UpperLeg_L'), legR = jointIdByName(material, 'UpperLeg_R')
  return material.frames.map(frame => {
    if (!legL || !legR) return { time: frame.time, frame: frame.frame, yaw: null }
    const a = frame.worldPositions[legL], b = frame.worldPositions[legR]
    const yaw = Math.atan2(-(a[2] - b[2]), a[0] - b[0])
    return { time: frame.time, frame: frame.frame, yaw }
  })
}

/** Hysteresis segmentation into preparation / main / recovery (kinematic estimate only). */
function segmentPhrases(perFrame, smoothed, fps) {
  const peak = Math.max(0, ...smoothed)
  const last = perFrame.length - 1
  const whole = reason => [{ kind: 'main', start: 0, end: last, startTime: perFrame[0].time, endTime: perFrame[last].time, evidence: { reason }, source: 'kinematic-estimate' }]
  if (!(peak > 0)) return whole('no-motion-signal')
  const hi = peak * .42, lo = peak * .22
  const minFrames = Math.max(3, Math.round(fps * .3))
  let firstActive = -1
  for (let i = 0, run = 0; i < smoothed.length; i++) {
    run = smoothed[i] >= hi ? run + 1 : 0
    if (run >= minFrames) { firstActive = i - run + 1; break }
  }
  if (firstActive < 0) return whole('never-crossed-threshold')
  let lastActive = last
  for (let i = smoothed.length - 1; i >= 0; i--) if (smoothed[i] >= lo) { lastActive = i; break }
  const segments = []
  const time = i => perFrame[i].time
  if (firstActive > 0) segments.push({ kind: 'preparation', start: 0, end: firstActive - 1, startTime: time(0), endTime: time(firstActive - 1), evidence: { peakActivity: peak, enterFraction: Number((hi / peak).toFixed(3)), frames: firstActive }, source: 'kinematic-estimate' })
  const mainStart = firstActive, mainEnd = Math.max(mainStart, lastActive)
  if (mainEnd >= mainStart) segments.push({ kind: 'main', start: mainStart, end: mainEnd, startTime: time(mainStart), endTime: time(mainEnd), evidence: { peakActivity: peak, frames: mainEnd - mainStart + 1 }, source: 'kinematic-estimate' })
  if (lastActive < last) segments.push({ kind: 'recovery', start: lastActive + 1, end: last, startTime: time(lastActive + 1), endTime: time(last), evidence: { peakActivity: peak, exitFraction: Number((lo / peak).toFixed(3)), frames: last - lastActive }, source: 'kinematic-estimate' })
  return segments
}

/** Contact intervals per foot from the shared kinematic estimator. */
function contactIntervals(material, fps) {
  const footIds = Object.fromEntries(SIDES.map(side => [side, jointIdByName(material, `Foot_${side === 'left' ? 'L' : 'R'}`)]))
  const hipsId = jointIdByName(material, 'Hips')
  if (!footIds.left || !footIds.right) return { intervals: [], landings: [], diagnostics: { method: 'unavailable', reason: 'missing-foot-joints' } }
  const frames = material.frames.map(frame => ({
    feet: Object.fromEntries(SIDES.map(side => [side, frame.worldPositions[footIds[side]]?.slice(0, 3)])),
    hips: hipsId ? frame.worldPositions[hipsId] : null,
  }))
  const estimate = analyzeFootContacts(frames, { fps })
  const intervals = []
  for (const side of SIDES) {
    let current = null
    estimate.frames.forEach((frame, i) => {
      const value = frame[side]
      const state = value === true ? 'plant' : value === false ? 'airborne' : 'unknown'
      if (!current || current.state !== state) {
        if (current) { current.end = i - 1; current.endTime = material.frames[i - 1].time; intervals.push(current) }
        current = { side, state, start: i, startTime: material.frames[i].time, end: null, endTime: null }
      }
    })
    if (current) { current.end = estimate.frames.length - 1; current.endTime = material.frames.at(-1).time; intervals.push(current) }
  }
  return { intervals, landings: estimate.landings, diagnostics: { ...estimate.diagnostics, method: 'automatic-kinematic-estimate', humanAnnotated: false, note: 'contact is estimated from ankle height/speed against a shared floor; not force, weight or a human label' } }
}

/** Accent anchors: landings plus local joint-velocity peaks, explicitly not song beats. */
function accentAnchors(material, perFrame, smoothed, contact) {
  const anchors = []
  const peak = Math.max(0, ...smoothed)
  for (const landing of contact.landings ?? []) {
    const frame = material.frames[landing.frame]
    if (frame) anchors.push({ time: frame.time, frame: landing.frame, kind: 'landing', side: landing.side, strength: peak ? Number(clamp(smoothed[landing.frame] / peak).toFixed(3)) : 0, source: 'kinematic-estimate' })
  }
  const radius = Math.max(2, Math.round(perFrame.length / 120))
  for (let i = radius; i < smoothed.length - radius; i++) {
    const value = smoothed[i]
    if (value < peak * .55) continue
    let isPeak = true
    for (let k = i - radius; k <= i + radius; k++) if (k !== i && smoothed[k] > value) { isPeak = false; break }
    if (!isPeak) continue
    if (anchors.some(anchor => Math.abs(anchor.frame - i) <= radius)) continue
    anchors.push({ time: perFrame[i].time, frame: i, kind: 'motion-peak', strength: Number(clamp(value / peak).toFixed(3)), source: 'kinematic-estimate' })
  }
  anchors.sort((a, b) => a.frame - b.frame)
  return anchors
}

/**
 * Full-dance structure annotation over a source material. Everything here is a
 * kinematic estimate from source motion only: no song audio, no human labels and
 * no forced musical beats. Segment kinds are exploratory grouping, not ground truth.
 */
export function annotateDanceStructure(material, { fps = 15, phases } = {}) {
  if (!material?.frames?.length || !material?.rig?.length) throw new TypeError('annotateDanceStructure requires a source material')
  if (!Number.isFinite(fps) || fps <= 0) throw new TypeError('fps must be positive')
  const { perFrame, smoothed } = activityEnvelope(material)
  const segments = phases ? normalizePhases(material, phases) : segmentPhrases(perFrame, smoothed, fps)
  const contact = contactIntervals(material, fps)
  const accents = accentAnchors(material, perFrame, smoothed, contact)
  const orientation = compressOrientation(orientationSeries(material), fps)
  const main = segments.find(segment => segment.kind === 'main')
  const mainAccents = accents.filter(anchor => main && anchor.time >= main.startTime && anchor.time <= main.endTime)
  const gaps = mainAccents.slice(1).map((anchor, i) => anchor.time - mainAccents[i].time).filter(gap => gap > 0)
  return {
    schema: 'dance-structure/v1',
    source: { sourceId: material.sourceId, duration: material.range.end, frameCount: material.frames.length, frameTime: material.frames[1] ? material.frames[1].time - material.frames[0].time : null },
    segments,
    accents,
    orientation,
    contact: { intervals: contact.intervals, diagnostics: contact.diagnostics },
    phraseHints: {
      mainAccentCount: mainAccents.length,
      medianAccentGapSeconds: median(gaps),
      impliedTempoBpm: median(gaps) ? Number((60 / median(gaps)).toFixed(1)) : null,
      candidatePhraseBoundaries: candidatePhraseBoundaries(mainAccents, main),
      note: 'accent spacing is a motion-rhythm hint from the dancer, not a detected song tempo; candidate boundaries group accents without claiming real choreographic phrases',
    },
    provenance: { source: 'kinematic-estimate', humanAnnotated: false, audio: 'none', materialSchema: material.schema ?? null },
    limitations: [
      'segments are exploratory kinematic grouping, not choreographic ground truth',
      'accents are motion peaks and estimated landings, not song beats or downbeats',
      'contact is a kinematic floor estimate, not weight, force or human annotation',
      'orientation is the hip-width axis in the source horizontal plane; no sensor calibration',
    ],
  }
}

/** Group accents into candidate phrase windows. Candidate only: needs listening review. */
function candidatePhraseBoundaries(accents, main) {
  if (!main || accents.length < 2) return []
  const size = 4
  const boundaries = []
  for (let i = 0; i < accents.length; i += size) {
    const group = accents.slice(i, i + size)
    const start = i === 0 ? main.startTime : group[0].time
    const end = accents[i + size] ? accents[i + size].time : main.endTime
    if (!(end > start)) continue
    boundaries.push({
      startTime: Number(start.toFixed(3)), endTime: Number(end.toFixed(3)),
      accentCount: group.length, kind: 'candidate-group',
      note: 'accent-count grouping; not a detected chorographic phrase boundary',
    })
  }
  return boundaries
}

function normalizePhases(material, phases) {  const time = frame => material.frames[frame]?.time ?? 0
  return phases
    .filter(phase => Number.isSafeInteger(phase.start) && Number.isSafeInteger(phase.end) && phase.end >= phase.start)
    .map(phase => ({
      kind: ['preparation', 'main', 'recovery'].includes(phase.kind) ? phase.kind : 'main',
      start: phase.start, end: phase.end, startTime: time(phase.start), endTime: time(phase.end),
      evidence: { source: phase.evidence ?? 'supplied' }, source: phase.source ?? 'supplied',
    }))
}

/** Keep orientation samples plus the significant turns, so the series stays readable. */
function compressOrientation(series, fps) {
  const samples = series.filter(sample => sample.yaw !== null)
  if (!samples.length) return { samples: [], turns: [], note: 'orientation unavailable (missing hip or upper-leg joints)' }
  let unwrapped = 0, previous = samples[0].yaw
  const absolute = samples.map(sample => {
    let delta = sample.yaw - previous
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    unwrapped += delta
    previous = sample.yaw
    sample.yawRadians = sample.yaw
    sample.yawDegrees = Number((sample.yaw * 180 / Math.PI).toFixed(1))
    sample.continuousRadians = Number(unwrapped.toFixed(4))
    return sample
  })
  const turns = []
  let lastTurn = -Infinity
  const radius = Math.max(1, Math.round(fps * .12))
  const smoothedAngles = smooth(absolute.map(sample => sample.continuousRadians), radius)
  for (let i = 1; i < smoothedAngles.length; i++) {
    const rate = Math.abs(smoothedAngles[i] - smoothedAngles[i - 1]) * fps
    if (rate < 2.0 || absolute[i].time - lastTurn < .5) continue
    turns.push({ time: absolute[i].time, frame: absolute[i].frame, yawDegrees: absolute[i].yawDegrees, turnRateRadPerSecond: Number(rate.toFixed(2)), source: 'kinematic-estimate' })
    lastTurn = absolute[i].time
  }
  const stride = Math.max(1, Math.round(fps * .5))
  return { samples: absolute.filter((sample, i) => i % stride === 0 || i === absolute.length - 1), turns, note: 'samples decimated to ~0.5s; turns use a smoothed >=2.0 rad/s hip-width rate with 0.5s debounce' }
}
