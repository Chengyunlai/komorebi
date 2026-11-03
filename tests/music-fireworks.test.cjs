const {test} = require('node:test')
const assert = require('node:assert/strict')
const load = () => import('../src/effects/music-fireworks.mjs')
const observation = (now, extra = {}) => ({now, age: .02, mode: 'system',
  signal: {streamId: 'a', state: 'tracking', sampleRate: 48000,
    sampleFrame: Math.round(now * 48000), lastOnsetFrame: Math.round(now * 48000),
    onsetStrength: 0, lastOnsetStrength: .8, energy: .7}, ...extra})

test('dense onsets produce sparse bursts and all embers expire', async () => {
  const {createMusicFireworks, FIREWORK_GAP} = await load()
  const fx = createMusicFireworks({random: () => .5}), times = []
  for (let i = 0; i < 300; i++) {
    const now = i / 10
    fx.advance(now)
    if (fx.observe(observation(now))) times.push(now)
    assert.ok(fx.bursts.length <= 1)
  }
  assert.ok(times.length >= 10 && times.length <= 14)
  assert.ok(times.slice(1).every((time, i) => time - times[i] >= FIREWORK_GAP))
  fx.advance(32)
  assert.equal(fx.bursts.length, 0)
})

test('stale, silent, paused and weak observations cannot fire', async () => {
  const {createMusicFireworks} = await load()
  for (const patch of [{age: .5}, {mode: 'off'}, {age: NaN}, {age: -.1}]) {
    assert.equal(createMusicFireworks().observe(observation(1, patch)), false)
  }
  for (const patch of [{state: 'silent'}, {state: 'lost'}, {energy: 0},
    {lastOnsetStrength: .1}, {lastOnsetFrame: 0}, {lastOnsetFrame: 96000}]) {
    const obs = observation(1); Object.assign(obs.signal, patch)
    assert.equal(createMusicFireworks().observe(obs), false)
  }
})

test('deduplicates held onsets, resets streams, preserves cooldown, respects disable', async () => {
  const {createMusicFireworks} = await load()
  const fx = createMusicFireworks()
  const first = observation(1)
  assert.equal(fx.observe(first), true)
  fx.advance(4)
  assert.equal(fx.observe({...first, now: 4}), false)
  const next = observation(4); next.signal.streamId = 'b'
  assert.equal(fx.observe(next), true)
  assert.equal(fx.observe({...observation(4.1), enabled: false}), false)
  assert.equal(fx.bursts.length, 0)
  assert.equal(fx.observe(observation(4.2)), false)
})

test('stronger music changes scale and particles without changing density budget', async () => {
  const {createMusicFireworks} = await load()
  const weak = createMusicFireworks(), strong = createMusicFireworks()
  const obs = observation(1)
  obs.signal.lastOnsetStrength = .2; obs.signal.energy = .2
  assert.equal(weak.observe(obs), true)
  assert.equal(strong.observe(observation(1)), true)
  assert.ok(strong.bursts[0].power > weak.bursts[0].power)
  assert.ok(strong.bursts[0].sparks.length > weak.bursts[0].sparks.length)
})

test('hand origin is exact and music is still required for a moving hand', async () => {
  const {createMusicFireworks} = await load()
  const fx = createMusicFireworks()
  assert.equal(fx.observe({...observation(1), requireOrigin: true}), false)
  const origin = {x: .38, y: .46, side: 'left', speed: .8}
  assert.equal(fx.observe({...observation(2), origin, requireOrigin: true}), true)
  assert.equal(fx.bursts[0].x, origin.x)
  assert.equal(fx.bursts[0].y, origin.y)
  assert.equal(fx.bursts[0].side, 'left')
  fx.advance(5)
  const silent = observation(5); silent.signal.state = 'silent'
  assert.equal(fx.observe({...silent, origin, requireOrigin: true}), false)
})

test('selects accents relative to recent peaks and recognizes energy contrast', async () => {
  const {createMusicFireworks} = await load()
  const fx = createMusicFireworks()
  const low = observation(1); low.signal.energy = .2
  assert.equal(fx.observe(low), true)
  // A new strong onset during cooldown updates the recent peak, but cannot fire.
  const peak = observation(3); peak.signal.lastOnsetStrength = 1; peak.signal.energy = .2
  assert.equal(fx.observe(peak), false)
  fx.advance(4)
  const weak = observation(5); weak.signal.lastOnsetStrength = .3; weak.signal.energy = .2
  assert.equal(fx.observe(weak), false)
  const rise = observation(6); rise.signal.lastOnsetStrength = .3; rise.signal.energy = .8
  assert.equal(fx.observe(rise), true)
  assert.equal(fx.bursts[0].reason, 'energy-rise')
})
