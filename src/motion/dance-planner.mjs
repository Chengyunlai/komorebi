/**
 * Offline dance-phrase planner (DANCE-03).
 *
 * Inputs: a dance-structure/v1 annotation (kinematic estimates over a full source
 * dance) plus a music description (bpm + an energy curve, optional beat list).
 * Output: a dance-plan/v1 that maps music time onto source phrases with explicit,
 * reviewable reasons. It is a heuristic planning baseline: no learning, no claim
 * that the plan is choreographically ideal, and no song-structure recognition.
 */

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const finite = v => Number.isFinite(v) ? v : 0
const median = values => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
}

const MODES = ['quiet', 'flow', 'drive', 'rising', 'settling']
const MODE_DYNAMICS = {quiet: .7, flow: .88, drive: 1.08, rising: 1.03, settling: .75}

function energyAt(music, time) {
  const points = music.energy
  if (!points?.length) return .5
  if (time <= points[0].time) return clamp(finite(points[0].value))
  if (time >= points.at(-1).time) return clamp(finite(points.at(-1).value))
  let lo = 0, hi = points.length - 1
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (points[mid].time <= time) lo = mid; else hi = mid }
  const a = points[lo], b = points[hi], span = b.time - a.time
  const alpha = span > 0 ? (time - a.time) / span : 0
  return clamp(a.value + (b.value - a.value) * alpha)
}

/** Beat grid in seconds; strength comes from the sampled music energy. */
function buildBeatGrid(music) {
  if (Array.isArray(music.beats) && music.beats.length) {
    return music.beats.map(beat => ({time: beat.time, strength: clamp(finite(beat.strength ?? energyAt(music, beat.time)))}))
  }
  const beatSeconds = 60 / clamp(finite(music.bpm) || 120, 40, 220)
  const grid = []
  for (let time = 0; time <= music.duration + 1e-9; time += beatSeconds) grid.push({time, strength: clamp(energyAt(music, time))})
  return grid
}

/** Coarse music sections from the energy curve, using the same state vocabulary as the director. */
function musicSections(music, fps = 4) {
  const step = 1 / fps, duration = music.duration
  let fast = null, slow = null
  const samples = []
  for (let time = 0; time <= duration + 1e-9; time += step) {
    const e = energyAt(music, time)
    if (fast === null) { fast = e; slow = e }
    fast += (e - fast) * (1 - Math.exp(-step / .35))
    slow += (e - slow) * (1 - Math.exp(-step / 3))
    const trend = fast - slow
    const mode = trend > .13 ? 'rising' : trend < -.13 ? 'settling' : fast < .24 ? 'quiet' : fast > .6 ? 'drive' : 'flow'
    samples.push({time, mode, energy: e})
  }
  const sections = []
  for (const sample of samples) {
    const last = sections.at(-1)
    if (last && last.mode === sample.mode) { last.end = sample.time; last.energySum += sample.energy; last.count++ }
    else sections.push({mode: sample.mode, start: sample.time, end: sample.time, energySum: sample.energy, count: 1})
  }
  return sections.map(section => ({mode: section.mode, start: section.start, end: Math.min(duration, section.end + step), energy: section.energySum / Math.max(1, section.count)}))
}

/** Candidate source phrases from the structure annotation, with their accents and support feet. */
function sourceLibrary(structure, options) {
  const boundaries = structure?.phraseHints?.candidatePhraseBoundaries
  const accents = structure?.accents ?? []
  const main = (structure?.segments ?? []).find(segment => segment.kind === 'main')
  const minPhrase = options.minPhraseSeconds ?? 2
  const maxPhrase = options.maxPhraseSeconds ?? 6
  let phrases = []
  if (Array.isArray(boundaries) && boundaries.length) {
    // Multi-granularity candidates: single groups plus 2- and 3-group merges, so the
    // planner can pick a phrase length close to the music window instead of always
    // stretching/compressing the same short group.
    const groups = []
    for (let i = 0; i < boundaries.length; i++) groups.push([boundaries[i]])
    for (let i = 0; i + 1 < boundaries.length; i++) groups.push([boundaries[i], boundaries[i + 1]])
    for (let i = 0; i + 2 < boundaries.length; i++) groups.push([boundaries[i], boundaries[i + 1], boundaries[i + 2]])
    phrases = groups
      .filter(group => group.at(-1).endTime - group[0].startTime >= minPhrase * .8)
      .map((group, index) => {
        const startTime = group[0].startTime, endTime = group.at(-1).endTime
        return {
          index, startTime, endTime, mergeCount: group.length,
          accents: accents.filter(accent => accent.time >= startTime && accent.time < endTime).map(accent => accent.time),
        }
      })
  } else if (main && accents.length) {
    const size = Math.max(2, Math.round(accents.length / 8))
    for (let i = 0; i < accents.length; i += size) {
      const group = accents.slice(i, i + size)
      phrases.push({index: phrases.length, startTime: group[0].time, endTime: accents[i + size]?.time ?? main.endTime, accents: group.map(accent => accent.time)})
    }
  }
  phrases = phrases.filter(phrase => {
    const length = phrase.endTime - phrase.startTime
    return length >= Math.max(1.2, minPhrase * .5) && length <= maxPhrase * 1.6
  })
  const supportAt = t => {
    const interval = (structure?.contact?.intervals ?? []).find(iv => iv.state === 'plant' && t >= iv.startTime && t <= iv.endTime)
    return interval ? interval.side : 'none'
  }
  const turnTimes = (structure?.orientation?.turns ?? []).map(turn => turn.time)
  const yawSamples = structure?.orientation?.samples ?? []
  const yawAt = t => {
    if (!yawSamples.length) return null
    let best = yawSamples[0]
    for (const sample of yawSamples) if (Math.abs(sample.time - t) < Math.abs(best.time - t)) best = sample
    return Number.isFinite(best.continuousRadians) ? best.continuousRadians : null
  }
  return phrases.map(phrase => {
    const length = phrase.endTime - phrase.startTime
    const accentRate = phrase.accents.length / Math.max(.001, length)
    return {
      ...phrase, length, accentRate,
      activity: clamp(accentRate / 2.2),
      startSupport: supportAt(phrase.startTime),
      endSupport: supportAt(phrase.endTime),
      startYaw: yawAt(phrase.startTime),
      endYaw: yawAt(phrase.endTime),
      turnsInside: turnTimes.filter(time => time >= phrase.startTime && time <= phrase.endTime).length,
    }
  }).filter(phrase => phrase.length > 0)
}

function transitionCost(previous, candidate) {
  if (!previous) return 0
  let cost = 0
  if (previous.endSupport !== 'none' && candidate.startSupport !== 'none' && previous.endSupport !== candidate.startSupport) cost += .25
  if (Number.isFinite(previous.endYaw) && Number.isFinite(candidate.startYaw)) {
    let delta = Math.abs(candidate.startYaw - previous.endYaw)
    delta = Math.min(delta, Math.PI * 2 - delta)
    cost += Math.min(1, delta / Math.PI) * .2
  }
  return cost
}

function choosePhrase(library, {mode, targetLength, targetActivity, usage, previous, repeatLimit, maxRepeatStreak}) {
  const candidates = library.map((phrase, index) => {
    const lengthFit = Math.abs(phrase.length - targetLength) / Math.max(1, targetLength)
    const repeats = usage[index]?.count ?? 0
    const novelty = mode === 'drive' || mode === 'rising' ? repeats * .35 : repeats * .06
    const energyFit = Math.abs(phrase.activity - (Number.isFinite(targetActivity) ? targetActivity : .5)) * .35
    const streakPenalty = previous?.sourceIndex === index && (usage[index]?.streak ?? 0) >= maxRepeatStreak ? .5 : 0
    return {phrase, index, repeats, score: lengthFit + novelty + energyFit + transitionCost(previous, phrase) + streakPenalty}
  })
  // Repeat limit is a hard cap while unused phrases remain.
  const underCap = candidates.filter(candidate => candidate.repeats < repeatLimit)
  const pool = underCap.length ? underCap : candidates
  pool.sort((a, b) => a.score - b.score || a.index - b.index)
  return pool[0]
}

/** Align a source phrase onto a music window; returns the time scale and accent-vs-beat error. */
function alignPhrase(phrase, windowStart, windowEnd, beatGrid, beatSeconds) {
  const windowLength = Math.max(.1, windowEnd - windowStart)
  const scale = windowLength / phrase.length
  const beats = beatGrid.filter(beat => beat.time >= windowStart - 1e-9 && beat.time <= windowEnd + 1e-9)
  const errors = []
  for (const accentTime of phrase.accents) {
    const musicTime = windowStart + (accentTime - phrase.startTime) * scale
    const nearest = beats.reduce((best, beat) => Math.abs(beat.time - musicTime) < Math.abs(best - musicTime) ? beat.time : best, beats[0]?.time ?? musicTime)
    errors.push(Math.abs(nearest - musicTime))
  }
  return {scale, errors}
}

/**
 * Plan phrases over the music. Deterministic: identical inputs give identical plans.
 */
export function planDancePhrases({structure, music, options = {}} = {}) {
  if (!structure?.segments?.length) throw new TypeError('planDancePhrases requires a dance structure annotation')
  if (!music || !Number.isFinite(music.duration) || music.duration <= 0) throw new TypeError('planDancePhrases requires a positive music duration')
  const minPhrase = options.minPhraseSeconds ?? 2
  const maxPhrase = options.maxPhraseSeconds ?? 6
  const repeatLimit = options.repeatLimit ?? 2
  const maxRepeatStreak = options.maxRepeatStreak ?? 1
  const minTimeScale = options.minTimeScale ?? .85
  const maxTimeScale = options.maxTimeScale ?? 1.15
  const library = sourceLibrary(structure, {minPhraseSeconds: minPhrase, maxPhraseSeconds: maxPhrase})
  if (!library.length) throw new Error('No usable source phrases in the structure annotation')
  const beatGrid = buildBeatGrid(music)
  const beatSeconds = beatGrid[1] ? beatGrid[1].time - beatGrid[0].time : 0.5
  // Style routing: an absolute BPM target shifts phrase choice so fast songs prefer
  // denser source phrases and slow songs prefer calmer ones, independent of energy.
  const bpmTarget = Number.isFinite(music.bpm) ? clamp((music.bpm - 70) / 120) : .5
  const sections = musicSections(music)
  // Silent tail (e.g. the trailing zero-signal seconds of the demo PCM) is left to the
  // player's fade-out instead of stretching a phrase to fill it.
  let planEnd = music.duration
  const energyPoints = music.energy ?? []
  for (let i = energyPoints.length - 1; i >= 0; i--) {
    if (energyPoints[i].value > .05) { planEnd = Math.min(music.duration, energyPoints[i].time + .5); break }
  }
  const usage = library.map(() => ({count: 0, streak: 0, lastUsed: -2}))
  const phrases = []
  let previous = null
  let cursor = 0
  const modeAt = time => {
    for (const section of sections) if (time >= section.start && time <= section.end) return section
    return sections.at(-1) ?? {mode: 'flow', energy: .5}
  }
  // Target the median source phrase length so the time scale sits near 1.0 instead of
  // riding one of the clamps for every phrase.
  const targetPhraseSeconds = options.targetPhraseSeconds ?? median(library.map(phrase => phrase.length)) ?? 5
  // Pick the source phrase first, then derive the music window from a bounded time scale.
  // This keeps every phrase at a similar speed instead of alternating 0.4x and 2x stretches.
  while (cursor < planEnd - .15) {
    const section = modeAt(cursor)
    const remaining = planEnd - cursor
    if (remaining < minPhrase * 1.2 && phrases.length) break
    const targetLength = clamp(Math.min(remaining, targetPhraseSeconds), minPhrase, maxPhrase)
    const targetActivity = clamp(.6 * section.energy + .4 * bpmTarget, 0, 1)
    const choice = choosePhrase(library, {mode: section.mode, targetLength, targetActivity, usage, previous, repeatLimit, maxRepeatStreak})
    const phrase = choice.phrase
    // A phrase that already contains a turn should not be sped up; fast turns read as snaps.
    const scaleCap = phrase.turnsInside > 0 ? Math.min(maxTimeScale, 1.0) : maxTimeScale
    const scale = clamp(targetLength / phrase.length, minTimeScale, scaleCap)
    let windowEnd = Math.min(planEnd, cursor + phrase.length * scale)
    const windowStart = cursor
    const alignment = alignPhrase(phrase, windowStart, windowEnd, beatGrid, beatSeconds)
    const repeatOf = usage[choice.index].count > 0 ? phrase.index : null
    const reason = section.mode === 'drive' || section.mode === 'rising' ? 'energy-rising-prefer-novel'
      : section.mode === 'quiet' || section.mode === 'settling' ? 'energy-falling-prefer-familiar'
        : 'steady-flow-balance-length-and-support'
    phrases.push({
      index: phrases.length,
      startTime: Number(windowStart.toFixed(3)), endTime: Number(windowEnd.toFixed(3)),
      startBeat: Number((windowStart / beatSeconds).toFixed(3)), endBeat: Number((windowEnd / beatSeconds).toFixed(3)),
      musicMode: section.mode, musicEnergy: Number(section.energy.toFixed(3)),
      source: {
        phraseIndex: phrase.index, startTime: phrase.startTime, endTime: phrase.endTime,
        startSupport: phrase.startSupport, endSupport: phrase.endSupport, accentCount: phrase.accents.length,
        kind: 'candidate-group',
      },
      timeScale: Number(alignment.scale.toFixed(4)),
      alignedAccents: phrase.accents.length,
      accentToBeatErrorMs: alignment.errors.length ? Math.round(median(alignment.errors) * 1000) : null,
      repeatOf, sourceIndex: choice.index,
      reason,
    })
    usage[choice.index] = {
      count: usage[choice.index].count + 1,
      streak: previous?.sourceIndex === choice.index ? (usage[choice.index].streak ?? 0) + 1 : 1,
      sourceIndex: choice.index,
    }
    previous = {sourceIndex: choice.index, endSupport: phrase.endSupport, endYaw: phrase.endYaw}
    cursor = windowEnd
  }
  const errors = phrases.map(phrase => phrase.accentToBeatErrorMs).filter(value => value !== null)
  const usedSources = new Set(phrases.map(phrase => phrase.sourceIndex))
  const repeats = phrases.filter(phrase => phrase.repeatOf !== null).length
  const sourceCounts = [...phrases.reduce((map, phrase) => map.set(phrase.sourceIndex, (map.get(phrase.sourceIndex) ?? 0) + 1), new Map()).values()]
  const repeatLimitRelaxed = sourceCounts.some(count => count > repeatLimit)
  return {
    schema: 'dance-plan/v1',
    music: {bpm: music.bpm ?? null, beatSeconds: Number(beatSeconds.toFixed(4)), duration: music.duration, energyPoints: music.energy?.length ?? 0},
    phrases,
    summary: {
      phraseCount: phrases.length, repeats, uniqueSources: usedSources.size, repeatLimitRelaxed,
      medianAccentToBeatErrorMs: errors.length ? Math.round(median(errors)) : null,
      coverageSeconds: Number(phrases.reduce((sum, phrase) => sum + (phrase.endTime - phrase.startTime), 0).toFixed(3)),
      planEndSeconds: Number(planEnd.toFixed(3)),
      modes: [...new Set(phrases.map(phrase => phrase.musicMode))],
    },
    provenance: {
      planner: 'heuristic-offline-baseline', structure: structure.provenance?.source ?? 'kinematic-estimate',
      music: 'caller-supplied energy/bpm only; no song structure recognition', learning: 'none', deterministic: true,
    },
    limitations: [
      'section labels come from an energy-curve heuristic, not detected verse/chorus/bar structure',
      'phrase choice balances length, novelty, energy and support-foot continuity; it is not a choreographic optimum',
      'accent-to-beat error assumes the supplied bpm; half/double-time interpretations are out of scope here',
      'source phrases remain candidate groups from kinematic accents, not true choreographic phrases',
    ],
  }
}
