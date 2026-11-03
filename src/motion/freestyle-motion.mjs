import {Quaternion, Vector3} from 'three'

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const mixQuat = (a, b, t) => new Quaternion().fromArray(a).slerp(new Quaternion().fromArray(b), t).toArray()
const angleBetween = (a, b) => new Quaternion().fromArray(a).angleTo(new Quaternion().fromArray(b))
const smooth = t => t * t * t * (t * (t * 6 - 15) + 10)
const quantile = (values, p) => values.slice().sort((a, b) => a - b)[Math.floor((values.length - 1) * p)] || 0
const decay = (dt, seconds) => seconds > 0 ? 1 - Math.exp(-dt / seconds) : 1

/** Play continuous windows of choreography; never interpolate across source clips.
 * Music controls window activity and gently varying playback rate, not bone angles.
 * Both sides of an overlap keep moving, and the final body/ankle pose shares one filter.
 */
export function createFreestyleMotionPlayer(frames, {
  fps = 15,
  segmentSeconds = 4.8,
  crossfadeSeconds = .6,
  sourceBpm = 120,
  recentSeconds = 3,
  clips = [{id: 0, start: 0, end: frames.length - 1}],
  smoothingSeconds = .06,
} = {}) {
  if (!Array.isArray(frames) || frames.length < 8) throw new TypeError('Freestyle player requires compiled frames')
  for (const [name, value] of Object.entries({fps, segmentSeconds, sourceBpm})) {
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be positive`)
  }
  for (const [name, value] of Object.entries({crossfadeSeconds, smoothingSeconds, recentSeconds})) {
    if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be nonnegative`)
  }
  if (!Array.isArray(clips) || !clips.length) throw new TypeError('Freestyle player requires clip boundaries')
  const ranges = clips.map((clip, i) => {
    const {start, end} = clip
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= frames.length || end - start < 1 || (i && start <= clips[i - 1].end)) throw new TypeError('Invalid or overlapping clip boundaries')
    return {id: clip.id ?? clip.name ?? i, start, end}
  })
  const bones = Object.keys(frames[0].rotations ?? {})
  const bodyBones = bones.filter(bone => /hips|spine|chest|UpperLeg|LowerLeg/i.test(bone))
  const angle = (a, b, names) => {
    let sum = 0, count = 0
    for (const name of names) if (a.rotations[name] && b.rotations[name]) {sum += angleBetween(a.rotations[name], b.rotations[name]); count++}
    return count ? sum / count : 0
  }
  const activity = new Float64Array(frames.length), bodyActivity = new Float64Array(frames.length)
  for (const range of ranges) for (let i = range.start + 1; i <= range.end; i++) {
    activity[i] = angle(frames[i - 1], frames[i], bones) * fps
    bodyActivity[i] = angle(frames[i - 1], frames[i], bodyBones) * fps
  }
  const prefix = values => {const p = new Float64Array(values.length + 1); for (let i = 0; i < values.length; i++) p[i + 1] = p[i] + values[i]; return p}
  const activitySum = prefix(activity), bodySum = prefix(bodyActivity)
  const average = (sum, start, end) => (sum[end + 1] - sum[start + 1]) / Math.max(1, end - start)
  const stride = Math.max(2, Math.round(fps * .4))
  const candidates = []
  for (const range of ranges) {
    // Reserve overlap material so the outgoing window can continue at the next cut.
    const span = Math.min(range.end - range.start, Math.ceil((segmentSeconds * 1.2 + crossfadeSeconds * 1.2) * fps))
    for (let start = range.start; start + span <= range.end; start += stride) {
      candidates.push({range, start, end: start + span, activity: average(activitySum, start, start + span), body: average(bodySum, start, start + span), leadBody: average(bodySum, start, start + Math.min(span, Math.ceil(fps * .8)))})
    }
  }
  const activityScale = Math.max(1e-6, quantile(candidates.map(c => c.activity), .9))
  const bodyScale = Math.max(1e-6, quantile(candidates.map(c => c.body), .9))
  // If material contains coordinated body movement, reject hand-only/still windows.
  const pool = candidates.filter(c => c.activity >= activityScale * .12 && c.body >= bodyScale * .15 && c.leadBody >= bodyScale * .1)
  const eligible = pool.length ? pool : candidates
  if (!eligible.length) throw new TypeError('No playable motion windows')

  function sampleAt(position, range) {
    const p = clamp(position, range.start, range.end)
    const i = Math.floor(p), j = Math.min(range.end, i + 1), t = p - i
    const a = frames[i], b = frames[j]
    return {
      rotations: Object.fromEntries(Object.entries(a.rotations).map(([bone, quat]) => [bone, b.rotations[bone] ? mixQuat(quat, b.rotations[bone], t) : quat.slice()])),
      hips: mix(a.hips, b.hips, t),
      feet: {left: mix(a.feet.left, b.feet.left, t), right: mix(a.feet.right, b.feet.right, t)},
    }
  }
  function blendPoses(a, b, t) {
    return {
      rotations: Object.fromEntries(Object.entries(b.rotations).map(([bone, quat]) => [bone, a.rotations[bone] ? mixQuat(a.rotations[bone], quat, t) : quat.slice()])),
      hips: mix(a.hips, b.hips, t),
      feet: {left: mix(a.feet.left, b.feet.left, t), right: mix(a.feet.right, b.feet.right, t)},
    }
  }
  const angularVelocity = (a, b) => {
    const q = new Quaternion().fromArray(a).invert().multiply(new Quaternion().fromArray(b)).normalize()
    if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w)
    const axis = new Vector3(q.x, q.y, q.z), length = axis.length()
    return length < 1e-8 ? axis : axis.multiplyScalar(2 * Math.atan2(length, q.w) * fps / length)
  }
  function velocityCost(position, range, candidate) {
    const i = Math.min(range.end - 1, Math.floor(position)), j = Math.min(candidate.range.end - 1, candidate.start)
    let sum = 0, count = 0
    for (const bone of bones) {
      if (![frames[i], frames[i + 1], frames[j], frames[j + 1]].every(f => f.rotations[bone])) continue
      sum += angularVelocity(frames[i].rotations[bone], frames[i + 1].rotations[bone]).distanceTo(angularVelocity(frames[j].rotations[bone], frames[j + 1].rotations[bone]))
      count++
    }
    return count ? sum / count / Math.max(1, activityScale) : 0
  }
  let current, position = 0, segmentAge = 0, outgoing = null, transition = 1, lastPose = null
  let segmentIndex = 0, switches = 0, weight = 0, filteredEnergy = .5, rate = 1
  const recentStarts = []
  function chooseStart(currentPose) {
    const target = (.2 + filteredEnergy * .8) * activityScale
    // Cheap window/pose ranking first; signed velocity is evaluated only for finalists.
    const ranked = eligible.map(candidate => {
      const poseCost = currentPose ? angle(currentPose, frames[candidate.start], bones) / Math.PI : 0
      const activityCost = Math.abs(candidate.activity - target) / activityScale
      const recent = recentStarts.some(start => Math.abs(start - candidate.start) < fps * recentSeconds) ? .6 : 0
      const variation = (Math.sin(candidate.start * 12.9898 + segmentIndex * 78.233) * 43758.5453 % 1 + 1) % 1 * .06
      return {candidate, cost: activityCost * .4 + poseCost * 1.8 + recent + variation}
    }).sort((a, b) => a.cost - b.cost).slice(0, 12)
    if (current) for (const item of ranked) item.cost += velocityCost(position, current.range, item.candidate) * .12
    ranked.sort((a, b) => a.cost - b.cost)
    return ranked[0].candidate
  }
  return {
    bank: {clips: ranges.map(c => ({...c, beats: null, anchors: [], activity: 1})), beatAligned: false, worldAlignment: 'y-up', rootPolicy: 'motion-matching', execution: 'source-ankle/v1'},
    step({dt = 1 / 60, active: on = false, energy = .5, beat = 0, bpm = null, clockEpoch: epoch} = {}) {
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1)
      const inputEnergy = clamp(Number.isFinite(energy) ? energy : .5)
      if (!current) {filteredEnergy = inputEnergy; current = chooseStart(null); position = current.start}
      filteredEnergy += (inputEnergy - filteredEnergy) * decay(dt, .4)
      const targetRate = clamp((Number.isFinite(bpm) && bpm > 0 ? bpm : sourceBpm) / sourceBpm, .85, 1.2)
      rate += (targetRate - rate) * decay(dt, .5)
      weight = clamp(weight + (on ? dt / .35 : -dt / .4))
      if (on || weight > 0) {
        position = Math.min(current.range.end, position + dt * fps * rate)
        segmentAge += dt
        if (outgoing) outgoing.position = Math.min(outgoing.range.end, outgoing.position + dt * fps * rate)
        if (on && transition >= 1 && (segmentAge >= segmentSeconds || position >= current.range.end)) {
          const next = chooseStart(lastPose ?? sampleAt(position, current.range))
          outgoing = {position, range: current.range}
          current = next; position = next.start; segmentAge = 0; transition = 0; switches++; segmentIndex++
          recentStarts.push(next.start); if (recentStarts.length > 12) recentStarts.shift()
        }
        transition = crossfadeSeconds ? Math.min(1, transition + dt / crossfadeSeconds) : 1
      }
      let pose = sampleAt(position, current.range)
      if (outgoing && transition < 1) pose = blendPoses(sampleAt(outgoing.position, outgoing.range), pose, smooth(transition))
      else outgoing = null
      if (lastPose && (on || weight > 0)) pose = blendPoses(lastPose, pose, decay(dt, smoothingSeconds))
      lastPose = pose
      if (!on && weight === 0) {segmentAge = 0; outgoing = null; transition = 1}
      return {...pose, weight, clockEpoch: epoch ?? 0, beat, clip: ranges.indexOf(current.range), clipBeat: (position - current.start) / fps, sourceFrame: position,
        support: 'double', timing: 'estimated', phaseError: 0, transitionPolicy: 'moving-window', switches, blockedTransitions: 0, limiter: {mode: 'coherent-pose-filter', smoothingSeconds}, plan: null,
        source: {mode: weight > 0 ? 'audio' : 'waiting', primitive: weight > 0 ? 'motion-matching' : 'rest', bpm}}
    },
  }
}
