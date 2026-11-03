import {Quaternion} from 'three'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const mixQuat = (a, b, t) => new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b), t).toArray()
const scaleQuat = (arr, amp) => new Quaternion().identity().slerp(new Quaternion().fromArray(arr), clamp(amp, .4, 1.35)).toArray()
const angleBetween = (a, b) => new Quaternion().fromArray(a).angleTo(new Quaternion().fromArray(b))

/**
 * Freestyle motion matching over a compiled real-dance library.
 *
 * The dancer does not follow a plan: every segment it picks a new start frame from the
 * whole library (music energy drives the desired activity, pose continuity keeps the cut
 * readable, recent starts are avoided) and plays it forward with a short crossfade.
 * Because the source frames are real choreography, amplitudes are those of a real dancer.
 */
export function createFreestyleMotionPlayer(frames, {
  fps = 15,
  segmentSeconds = 1.4,
  crossfadeSeconds = .3,
  sourceBpm = 120,
  recentSeconds = 3,
} = {}) {
  if (!Array.isArray(frames) || frames.length < 8) throw new TypeError('Freestyle player requires compiled frames')
  if (!Number.isFinite(fps) || fps <= 0) throw new TypeError('fps must be positive')
  if (!Number.isFinite(segmentSeconds) || segmentSeconds <= 0) throw new TypeError('segmentSeconds must be positive')

  // Per-frame activity (mean joint rotation speed) drives the energy match.
  const bones = Object.keys(frames[0].rotations ?? {})
  const activity = new Float32Array(frames.length)
  for (let i = 1; i < frames.length; i++) {
    let sum = 0, count = 0
    for (const bone of bones) {
      const a = frames[i - 1].rotations?.[bone], b = frames[i].rotations?.[bone]
      if (a && b) { sum += angleBetween(a, b); count++ }
    }
    activity[i] = count ? sum / count : 0
  }
  const maxActivity = Math.max(1e-6, ...Array.from(activity))
  const stride = Math.max(2, Math.round(fps * .2))

  function sampleAt(position) {
    const p = clamp(position, 0, frames.length - 1.001)
    const i = Math.floor(p), j = Math.min(frames.length - 1, i + 1), t = p - i
    const a = frames[i], b = frames[j]
    const rotations = Object.fromEntries(Object.entries(a.rotations).map(([bone, quat]) => [bone, b.rotations?.[bone] ? mixQuat(quat, b.rotations[bone], t) : quat]))
    return {
      rotations,
      hips: b.hips ? mix(a.hips, b.hips, t) : a.hips,
      feet: b.feet ? {left: mix(a.feet.left, b.feet.left, t), right: mix(a.feet.right, b.feet.right, t)} : a.feet,
    }
  }

  function blendPoses(a, b, t) {
    const rotations = Object.fromEntries(Object.entries(b.rotations).map(([bone, quat]) => [bone, a.rotations?.[bone] ? mixQuat(a.rotations[bone], quat, t) : quat]))
    return {
      rotations,
      hips: a.hips && b.hips ? mix(a.hips, b.hips, t) : b.hips,
      feet: a.feet && b.feet ? {left: mix(a.feet.left, b.feet.left, t), right: mix(a.feet.right, b.feet.right, t)} : b.feet,
    }
  }

  let position = 0, segmentStart = 0, segmentAge = 0
  let previousPose = null, fromPose = null, transition = 1
  const recentStarts = []
  let segmentIndex = 0, switches = 0

  function chooseStart(currentPose, energy) {
    const targetActivity = clamp(.15 + energy * .85) * maxActivity
    let best = 0, bestScore = Infinity
    const minActivity = Math.max(targetActivity * .45, .06 * maxActivity)
    for (let start = stride; start < frames.length - stride * 2; start += stride) {
      if (activity[start] < minActivity) continue  // never park on a near-static stretch
      const activityScore = Math.abs(activity[start] - targetActivity) / maxActivity
      let poseScore = 0
      if (currentPose) {
        let sum = 0, count = 0
        for (const bone of bones) {
          const a = currentPose.rotations?.[bone], b = frames[start].rotations?.[bone]
          if (a && b) { sum += angleBetween(a, b); count++ }
        }
        poseScore = count ? (sum / count) / Math.PI : 0
      }
      const recent = recentStarts.reduce((sum, item) => sum + (Math.abs(item.start - start) < fps * recentSeconds ? .6 : 0), 0)
      // Deterministic jitter keeps repeated choices from locking together.
      const jitter = (Math.sin(start * 12.9898 + segmentIndex * 78.233) * 43758.5453 % 1 + 1) % 1 * .25
      // Without a current pose (first pick) energy decides; afterwards continuity dominates.
      const score = activityScore * (currentPose ? .35 : 1) + poseScore * 1.4 + recent + jitter
      if (score < bestScore) { bestScore = score; best = start }
    }
    return best
  }

  return {
    bank: {
      clips: [{id: 0, start: 0, end: frames.length - 1, beats: null, anchors: [], activity: 1}],
      beatAligned: false, worldAlignment: 'y-up', rootPolicy: 'motion-matching', execution: 'source-ankle/v1',
    },
    step({dt = 1 / 30, active: on = false, energy = .5, beat = 0, bpm = null, clockEpoch: epoch, onset = false, accent = 0} = {}) {
      if (!on) {
        previousPose = null
        return {...sampleAt(position), weight: 0, clockEpoch: 0, beat, clip: 0, clipBeat: 0, sourceFrame: position,
          support: 'double', timing: 'estimated', phaseError: 0, transitionPolicy: 'motion-matching', switches,
          blockedTransitions: 0, limiter: {mode: 'motion-matching'}, plan: null,
          source: {mode: 'waiting', primitive: 'rest', bpm}}
      }
      if (previousPose === null) {
        segmentStart = chooseStart(null, energy)
        position = segmentStart
        segmentAge = 0
        transition = 1
        fromPose = null
      }
      const rate = clamp((Number.isFinite(bpm) ? bpm : sourceBpm) / sourceBpm, .85, 1.2) * (0.9 + energy * .25)
      position += dt * fps * rate
      segmentAge += dt
      const segmentLength = segmentSeconds
      if (position >= frames.length - 2) position = frames.length - 2
      const mature = segmentAge >= segmentLength * .6
      // Force a fresh segment when the current stretch is near-static and the clip is mature.
      const targetActivity = clamp(.15 + energy * .85) * maxActivity
      const floorActivity = Math.max(targetActivity * .45, .06 * maxActivity)
      const lowActivity = (activity[Math.floor(position)] ?? maxActivity) < floorActivity * .5
      const finished = segmentAge >= segmentLength || position >= segmentStart + segmentLength * fps * rate || (onset && mature) || (lowActivity && mature)
      if (finished) {
        const next = chooseStart(sampleAt(position), energy)
        fromPose = sampleAt(position)
        segmentStart = next
        position = next
        segmentAge = 0
        transition = 0
        switches++
        segmentIndex++
        recentStarts.push({start: next, at: segmentIndex})
        while (recentStarts.length > 24) recentStarts.shift()
      }
      const sampled = sampleAt(position)
      previousPose = sampled
      if (transition < 1) transition = Math.min(1, transition + dt / Math.max(.05, crossfadeSeconds))
      const blended = transition < 1 && fromPose ? blendPoses(fromPose, sampled, transition * transition * (3 - 2 * transition)) : sampled
      // Music energy and accents set how strongly the body articulates each pose.
      const amplitude = clamp(.82 + energy * .33 + accent * .12, .7, 1.25)
      const pose = {rotations: Object.fromEntries(Object.entries(blended.rotations).map(([bone, quat]) => [bone, scaleQuat(quat, amplitude)])), hips: blended.hips, feet: blended.feet}
      return {
        ...pose,
        weight: 1,
        clockEpoch: epoch ?? 0,
        beat,
        clip: 0,
        clipBeat: (position - segmentStart) / fps,
        sourceFrame: position,
        support: 'double',
        timing: 'estimated',
        phaseError: 0,
        transitionPolicy: 'motion-matching',
        switches,
        blockedTransitions: 0,
        limiter: {mode: 'motion-matching'},
        plan: null,
        source: {mode: 'audio', primitive: 'motion-matching', bpm},
      }
    },
  }
}
