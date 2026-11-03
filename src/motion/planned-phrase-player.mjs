import {Quaternion} from 'three'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const mixQuat = (a, b, t) => new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b), t).toArray()

/**
 * Planned phrase player: executes a dance-plan/v1 over compiled source frames while a
 * music clock advances. The plan decides which source phrase plays when and how much it
 * is time-scaled; this player only maps music time -> source time and emits poses the
 * daily executor can consume. Deterministic and independent of the UI.
 */
export function createPlannedPhrasePlayer(frames, plan, {fps = 15, fadeSeconds = .35, transitionSeconds = .45} = {}) {
  if (!Array.isArray(frames) || !frames.length) throw new TypeError('Planned player requires compiled frames')
  if (!plan?.phrases?.length) throw new TypeError('Planned player requires a dance plan with phrases')
  if (!Number.isFinite(fps) || fps <= 0) throw new TypeError('fps must be positive')
  const beatSeconds = plan.music?.beatSeconds
  if (!Number.isFinite(beatSeconds) || beatSeconds <= 0) throw new TypeError('Plan must declare a positive beatSeconds')
  let phrases = plan.phrases
  let weight = 0, active = false, clockEpoch = null, lastBeat = 0
  let phraseIndex = -1, switches = 0, lastSourceFrame = 0
  let lastCleanPose = null, transitionFrom = null, transition = 1, activeTransitionSeconds = transitionSeconds
  const smoothstep = t => t * t * (3 - 2 * t)
  function blendPoses(a, b, t) {
    const rotations = Object.fromEntries(Object.entries(b.rotations).map(([bone, quat]) => [bone, a.rotations?.[bone] ? mixQuat(a.rotations[bone], quat, t) : quat]))
    const hips = a.hips && b.hips ? mix(a.hips, b.hips, t) : b.hips
    const feet = a.feet && b.feet ? {left: mix(a.feet.left, b.feet.left, t), right: mix(a.feet.right, b.feet.right, t)} : b.feet
    return {rotations, hips, feet}
  }

  function sampleAt(sourceTime) {
    const position = clamp(sourceTime * fps, 0, frames.length - 1)
    const i = Math.floor(position), j = Math.min(frames.length - 1, i + 1), t = position - i
    const a = frames[i], b = frames[j]
    const rotations = Object.fromEntries(Object.entries(a.rotations).map(([bone, quat]) => {
      const other = b.rotations?.[bone]
      return [bone, other ? mixQuat(quat, other, t) : quat]
    }))
    return {
      rotations,
      hips: b.hips ? mix(a.hips, b.hips, t) : a.hips,
      feet: b.feet ? {left: mix(a.feet.left, b.feet.left, t), right: mix(a.feet.right, b.feet.right, t)} : a.feet,
    }
  }

  function phraseAt(musicTime) {
    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i]
      if (musicTime >= phrase.startTime - 1e-9 && musicTime < phrase.endTime + 1e-9) return i
    }
    return musicTime < phrases[0].startTime ? 0 : phrases.length - 1
  }

  function poseDistance(a, b) {
    if (!a) return {maxAngle: 0, feetDistance: 0}
    let maxAngle = 0
    for (const [bone, quat] of Object.entries(b.rotations)) {
      const previous = a.rotations?.[bone]
      if (!previous) continue
      maxAngle = Math.max(maxAngle, new Quaternion().fromArray(previous).angleTo(new Quaternion().fromArray(quat)))
    }
    const feetDistance = a.feet && b.feet
      ? (Math.hypot(...a.feet.left.map((v, i) => v - b.feet.left[i])) + Math.hypot(...a.feet.right.map((v, i) => v - b.feet.right[i]))) / 2
      : 0
    return {maxAngle, feetDistance}
  }

  function setPlan(nextPlan, {startTime = 0} = {}) {
    if (!nextPlan?.phrases?.length) throw new TypeError('setPlan requires phrases')
    const shift = startTime - (nextPlan.phrases[0]?.startTime ?? 0)
    phrases = nextPlan.phrases.map(phrase => ({
      ...phrase,
      startTime: Number((phrase.startTime + shift).toFixed(3)),
      endTime: Number((phrase.endTime + shift).toFixed(3)),
      startBeat: Number(((phrase.startTime + shift) / beatSeconds).toFixed(3)),
      endBeat: Number(((phrase.endTime + shift) / beatSeconds).toFixed(3)),
    }))
    phraseIndex = -1
    transition = 1
    transitionFrom = null
    activeTransitionSeconds = transitionSeconds
  }

  return {
    bank: {
      clips: phrases.map((phrase, id) => ({id, start: phrase.source.phraseIndex, end: phrase.source.phraseIndex, beats: null, anchors: [], activity: phrase.musicEnergy ?? 0})),
      beatAligned: false, worldAlignment: 'y-up', rootPolicy: 'planned-phrases', execution: 'source-ankle/v1',
      planSummary: plan.summary ?? null,
    },
    setPlan,
    step({dt = 1 / 30, active: on = false, beat = 0, clockEpoch: epoch, bpm, timing} = {}) {
      if (epoch !== undefined && Number.isFinite(epoch) && epoch !== clockEpoch) {
        clockEpoch = epoch
        if (active) { phraseIndex = -1; switches = 0 }
      }
      if (on && !active) { active = true; phraseIndex = -1; switches = 0; lastBeat = beat ?? 0 }
      if (!on && active) active = false
      weight = on ? Math.min(1, weight + dt / Math.max(.05, fadeSeconds)) : Math.max(0, weight - dt / Math.max(.05, fadeSeconds))
      if (on && weight > 0) lastBeat = Math.max(lastBeat, Number.isFinite(beat) ? beat : lastBeat)
      const musicTime = clamp((Number.isFinite(beat) ? beat : lastBeat) * beatSeconds, 0, phrases.at(-1).endTime)
      const nextIndex = phraseAt(musicTime)
      const switched = nextIndex !== phraseIndex && phraseIndex >= 0
      if (nextIndex !== phraseIndex) { if (phraseIndex >= 0) switches++; phraseIndex = nextIndex }
      const phrase = phrases[phraseIndex]
      const sourceTime = phrase.source.startTime + (musicTime - phrase.startTime) / (phrase.timeScale || 1)
      const sampled = sampleAt(sourceTime)
      if (switched && lastCleanPose) {
        // A single fixed blend keeps the rhythm consistent; pose mismatch is handled by planning.
        transitionFrom = lastCleanPose
        transition = 0
        activeTransitionSeconds = transitionSeconds
      }
      lastCleanPose = sampled
      if (transition < 1) transition = Math.min(1, transition + dt / Math.max(.05, activeTransitionSeconds))
      const pose = transition < 1 && transitionFrom ? blendPoses(transitionFrom, sampled, smoothstep(transition)) : sampled
      lastSourceFrame = sourceTime * fps
      return {
        ...pose,
        weight,
        clockEpoch: clockEpoch ?? 0,
        beat: Number.isFinite(beat) ? beat : lastBeat,
        clip: phraseIndex,
        clipBeat: (musicTime - phrase.startTime) / (phrase.timeScale || 1),
        sourceFrame: lastSourceFrame,
        support: 'double',
        timing: timing ?? 'estimated',
        phaseError: 0,
        transitionPolicy: 'planned-phrases',
        switches,
        blockedTransitions: 0,
        limiter: {mode: 'planned-phrases'},
        plan: {
          phraseIndex, musicTime: Number(musicTime.toFixed(3)),
          sourcePhrase: phrase.source.phraseIndex, timeScale: phrase.timeScale,
          musicMode: phrase.musicMode, reason: phrase.reason,
          transition: {active: transition < 1, progress: Number(transition.toFixed(3)), seconds: Number(activeTransitionSeconds.toFixed(3))},
        },
        source: {
          mode: weight > 0 ? 'audio' : 'waiting',
          primitive: 'planned-phrase',
          bpm: Number.isFinite(bpm) ? bpm : (plan.music?.bpm ?? null),
        },
      }
    },
  }
}
