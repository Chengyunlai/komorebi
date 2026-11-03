// Continuous music-driven groove.
//
// Unlike the phrase-based dance (discrete themes/segments), every joint angle here is a
// continuous function of the live music signal plus smoothed state. There is no action
// library and no segment switching: the body keeps reacting, with layered periodic motion
// (knee bounce, hip sway, torso roll, arm swing), accent impulses on onsets, and slow
// energy/spectrum modulation. All channels are low-pass filtered so changes stay organic.
const TAU = Math.PI * 2
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = t => t * t * (3 - 2 * t)

// Cheap deterministic value noise for organic micro-variation (seeded per instance).
const makeNoise = seed => {
  const state = {value: seed || 1}
  return () => {
    state.value = (state.value * 16807) % 2147483647
    return (state.value / 2147483647) * 2 - 1
  }
}

export function createContinuousGroove({seed = 1, personality = {}} = {}) {
  const noise = makeNoise(seed)
  const norms = {head: .5, torso: .5, arm: .5, hip: .5}
  const state = {
    time: 0,
    bounce: 0,        // knee spring, tracks the beat
    sway: 0,          // side-to-side weight shift
    hip: 0,           // hip tilt
    torsoRoll: 0,
    torsoTwist: 0,
    headNod: 0,
    headTilt: 0,
    armLift: .3,      // continuous arm posture (0 = down, 1 = up)
    armLiftAlt: .25,
    step: 0,          // alternating foot lift (continuous)
    crouch: 0,        // slow up/down body bob
    accent: 0,        // decays after each onset
    lastOnsetAt: -10,
    stillFor: 0,
  }
  const smoothTo = (current, target, dt, rate) => current + (target - current) * (1 - Math.exp(-dt * rate))
  const noiseAt = rate => noise() * rate

  function step({dt = 1 / 30, active = true, energy = .5, beat = 0, bpm = 120, onset = false, accent = 0, bands = null, age = 0} = {}) {
    dt = clamp(dt, 1 / 120, .2)
    state.time += dt
    if (!active) state.stillFor += dt
    else state.stillFor = 0
    const still = clamp(state.stillFor, 0, 2) / 2
    const activity = clamp((1 - still) * (.55 + energy * .75), 0, 1.4)
    const beatPhase = ((beat % 1) + 1) % 1
    const beatCount = beat  // continuous beat count: slow cycles must use this, not beatPhase
    const slow = state.time * (bpm / 120) * TAU
    const bandsHi = bands ? clamp((bands.high ?? .1) * 2, 0, 1) : .1
    const bandsLow = bands ? clamp((bands.low ?? .3) * 1.5, 0, 1) : .3
    const bandsMid = bands ? clamp((bands.mid ?? .3) * 1.5, 0, 1) : .3

    // Accent impulse: decays exponentially, re-armed on onsets; stronger accents hit harder.
    if (onset) state.lastOnsetAt = state.time
    const accentTarget = onset ? Math.max(.35, accent) : 0
    state.accent = smoothTo(state.accent, accentTarget, dt, onset ? 26 : 9)
    const impulse = state.accent

    // === Continuous periodic drives (no discrete selection anywhere) ===
    // Knee bounce: two dips per beat, depth follows energy and bass (drops get deeper).
    const bounceTarget = (.10 + activity * (.26 + bandsLow * .26)) * (.55 + .45 * Math.cos(TAU * beatPhase * 2)) + impulse * .34 + noiseAt(.015)
    state.bounce = smoothTo(state.bounce, bounceTarget, dt, 26)

    // Alternating foot lift: every 2 beats the weight transfers side to side continuously.
    const stepTarget = Math.sin(TAU * beatCount * .5) * (.5 + .5 * activity) + impulse * .5
    state.step = smoothTo(state.step, stepTarget, dt, 10)
    // Slow body bob (up on the phrase, down on the beat) adds vertical life beyond the knee bounce.
    const crouchTarget = .5 + .5 * Math.sin(TAU * beatCount * .25 + .7) * (.4 + activity * .6) + impulse * .3
    state.crouch = smoothTo(state.crouch, crouchTarget, dt, 6)

    // Weight shift: one cycle every 2 beats, alternating sides; impulse on accent adds a kick.
    const swayTarget = Math.sin(TAU * beatCount * .5 + .4) * (.16 + activity * .16) + impulse * .14 * Math.sin(TAU * beatPhase + state.time * .3) + noiseAt(.012)
    state.sway = smoothTo(state.sway, swayTarget, dt, 12)

    // Hip: counter-rotation to the shoulder line, plus depth from the low band.
    const hipTarget = Math.sin(TAU * beatCount * .5 + 1.1) * (.16 + activity * .18) + bandsLow * .08 + noiseAt(.01)
    state.hip = smoothTo(state.hip, hipTarget, dt, 9)

    // Torso: rolling and twisting at different rates so the pose always keeps moving.
    const rollTarget = Math.sin(TAU * beatCount * .5 + 2.2) * (.10 + activity * .12) + impulse * .08
    state.torsoRoll = smoothTo(state.torsoRoll, rollTarget, dt, 7)
    const twistTarget = Math.sin(TAU * beatCount * .25 + .9) * (.14 + activity * .16) + Math.sin(slow * .37) * .06 + noiseAt(.012)
    state.torsoTwist = smoothTo(state.torsoTwist, twistTarget, dt, 6)

    // Head: nod on the beat, tilt on the phrase, both modulated by highs and energy.
    const nodTarget = Math.sin(TAU * beatPhase * 1 + .6) * (.04 + bandsHi * .08 + activity * .07) - bandsLow * .06 + impulse * .08
    state.headNod = smoothTo(state.headNod, nodTarget, dt, 16)
    const tiltTarget = Math.sin(TAU * beatCount * .5 + 1.8) * (.05 + activity * .07) + Math.sin(slow * .23) * .035 + noiseAt(.015)
    state.headTilt = smoothTo(state.headTilt, tiltTarget, dt, 10)

    // Arms: two independent layers (left/right) that drift with different periods, so the
    // silhouette changes continuously instead of snapping between a few fixed gestures.
    const liftBase = .34 + activity * .46
    const armLiftTarget = clamp(liftBase + Math.sin(TAU * beatCount * .5 + .2) * (.20 + activity * .24) + Math.sin(slow * .21 + 1.7) * .10 + impulse * .18 + noiseAt(.02), 0, 1.2)
    state.armLift = smoothTo(state.armLift, armLiftTarget, dt, 8)
    const armLiftAltTarget = clamp(liftBase + Math.sin(TAU * beatCount * .5 + 2.6) * (.20 + activity * .24) + Math.sin(slow * .19 + .3) * .10 + impulse * .18 + noiseAt(.02), 0, 1.2)
    state.armLiftAlt = smoothTo(state.armLiftAlt, armLiftAltTarget, dt, 8)

    // === Map the continuous state onto the skeleton ===
    const bounce = clamp(state.bounce, 0, .7)
    const sway = state.sway
    const step = clamp(state.step, -1, 1)
    const crouch = clamp(state.crouch, 0, 1)
    const knee = .22 + bounce * 1.8 + crouch * .45
    const hipsDrop = .03 + bounce * .30 + crouch * .10
    const hipsTwist = state.hip * .9
    const hipsLean = state.sway * .5

    const armLift = state.armLift
    const armLiftAlt = state.armLiftAlt
    const armSwing = Math.sin(TAU * beatCount * .5 + .2) * .28 * activity
    const armSwingAlt = Math.sin(TAU * beatCount * .5 + 2.6) * .28 * activity
    const elbow = .30 + compatElbow(activity) + crouch * .18
    const upperArmZ = -1.16 + armLift * 2.2
    const upperArmAltZ = -1.16 + armLiftAlt * 2.2
    const upperArmX = .20 + armSwing + impulse * .16
    const upperArmAltX = .20 + armSwingAlt + impulse * .16
    const shoulder = impulse * .12 + Math.sin(slow * .3) * .03

    const rotations = {
      hips: [hipsDrop * .25, hipsTwist, hipsLean],
      spine: [.04 + bounce * .10, hipsTwist * .3, state.torsoRoll * .45],
      chest: [.03 + bounce * .07, state.torsoTwist * .5 + hipsTwist * .25, state.torsoRoll * .55],
      upperChest: [.02 + bounce * .04, state.torsoTwist * .35, state.torsoRoll * .3],
      neck: [state.headNod * .5, state.torsoTwist * .18, state.headTilt * .4],
      head: [state.headNod, state.torsoTwist * .2, state.headTilt],
      leftShoulder: [0, shoulder, -shoulder * .5],
      rightShoulder: [0, -shoulder, shoulder * .5],
      leftUpperArm: [upperArmX, 0, upperArmZ],
      rightUpperArm: [upperArmAltX, 0, -upperArmAltZ],
      leftLowerArm: [-elbow - armSwing * .25, 0, .06],
      rightLowerArm: [-elbow - armSwingAlt * .25, 0, -.06],
      leftHand: [impulse * .10, 0, 0],
      rightHand: [impulse * .10, 0, 0],
      leftUpperLeg: [-knee * .62 - Math.max(0, -step) * .30, 0, -sway * .35],
      rightUpperLeg: [-knee * .62 - Math.max(0, step) * .30, 0, -sway * .35],
      leftLowerLeg: [knee + Math.max(0, -step) * .35, 0, 0],
      rightLowerLeg: [knee + Math.max(0, step) * .35, 0, 0],
      leftFoot: [bounce * .22 - Math.max(0, -step) * .25, 0, 0],
      rightFoot: [bounce * .22 - Math.max(0, step) * .25, 0, 0],
    }
    const feet = {
      left: [-sway * .10 + impulse * .02, Math.max(0, -step) * .06 + impulse * .02, 0],
      right: [sway * .10 + impulse * .02, Math.max(0, step) * .06 + impulse * .02, 0],
    }
    return {rotations, hips: [sway * .06, -hipsDrop, hipsTwist * .04], feet, weight: clamp(activity, 0, 1), energy}
  }

  function compatElbow(activity) { return .08 + activity * .10 }
  return {step, state}
}
