// Decorative consumer of music observations; never writes dance or beat state.
export const FIREWORK_GAP = 2.2
export const FIREWORK_LIFETIME = 1.15
const palettes = [[44, 92], [185, 225], [285, 335], [335, 30]]
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function createMusicFireworks({random = Math.random} = {}) {
  let stream, lastOnset, lastSample, lastTime, energyFloor, onsetPeak = 0, lastBurst = -Infinity, count = 0
  const bursts = []
  return {
    bursts,
    clear() { bursts.length = 0 },
    observe({signal, mode, age = Infinity, now, enabled = true, origin = null, requireOrigin = false}) {
      if (signal?.streamId !== stream) {
        stream = signal?.streamId
        lastOnset = lastSample = lastTime = energyFloor = undefined
        onsetPeak = 0
        // Keep the density budget even across stream changes.
        bursts.length = 0
      }
      if (!enabled) { bursts.length = 0; return false }
      const valid = ['demo', 'netease', 'system'].includes(mode) &&
        ['warming', 'tracking'].includes(signal?.state) &&
        Number.isFinite(age) && age >= 0 && age <= .35
      if (!valid) { lastSample = lastTime = energyFloor = undefined; onsetPeak = 0 }
      let lift = 0
      if (valid && signal.sampleFrame !== lastSample) {
        const dt = lastTime === undefined ? 0 : clamp(now - lastTime, 0, .35)
        const energy = clamp(signal.energy || 0, 0, 1)
        energyFloor ??= energy
        lift = Math.max(0, energy - energyFloor)
        energyFloor += (energy - energyFloor) * (1 - Math.exp(-dt / 4))
        onsetPeak *= Math.exp(-dt / 6)
        lastSample = signal.sampleFrame
        lastTime = now
      }
      const onset = signal?.lastOnsetFrame
      if (!Number.isFinite(onset) || onset === lastOnset) return false
      lastOnset = onset
      const onsetAge = (signal.sampleFrame - onset) / signal.sampleRate + age
      const strength = signal.lastOnsetStrength ?? signal.onsetStrength ?? 0
      if (!valid ||
          !Number.isFinite(onsetAge) || onsetAge < 0 || onsetAge > .18 ||
          !(signal.energy > .12) || !(strength > .18) ||
          bursts.length >= 1) return false
      const salient = strength >= Math.max(.2, onsetPeak * .72)
      onsetPeak = Math.max(onsetPeak, strength)
      const rising = lift > .14
      const gesture = (origin?.speed || 0) > .35 && strength > .28
      // A recent stronger transient suppresses filler. Quiet passages breathe
      // longer; a rise is an observed energy contrast, not a chorus label.
      const gap = FIREWORK_GAP + Math.max(0, .65 - signal.energy) * 3
      if ((!salient && !rising && !gesture) || now - lastBurst < gap ||
          (requireOrigin && !origin)) return false
      lastBurst = now
      const power = clamp(strength * .65 + signal.energy * .35 + lift * .3, 0, 1)
      const [hue, secondaryHue] = palettes[count % palettes.length]
      const side = count++ % 2
      const rays = 24 + Math.round(power * 8)
      bursts.push({at: now, x: origin?.x ?? (side ? .76 : .24), y: origin?.y ?? (.25 + random() * .16),
        side: origin?.side ?? 'ambient', hand: Boolean(origin),
        reason: rising ? 'energy-rise' : gesture ? 'music-and-gesture' : 'music-accent',
        power, hue, secondaryHue,
        sparks: Array.from({length: rays}, (_, i) => ({
          angle: i / rays * Math.PI * 2 + (random() - .5) * .09,
          speed: .55 + random() * .45, life: .75 + random() * .25,
          size: .7 + random() * .7, phase: random() * Math.PI * 2,
        }))})
      return true
    },
    advance(now) {
      for (let i = bursts.length - 1; i >= 0; i--)
        if (now - bursts[i].at > FIREWORK_LIFETIME) bursts.splice(i, 1)
      return bursts.length > 0
    },
  }
}

// Cache the soft spark once per color/context; drawing particles does not need
// a fresh shadow blur filter for every spark on every frame.
const spriteCaches = new WeakMap()
function sparkSprite(ctx, hue) {
  let cache = spriteCaches.get(ctx)
  if (!cache) { cache = new Map(); spriteCaches.set(ctx, cache) }
  if (cache.has(hue)) return cache.get(hue)
  const canvas = ctx.canvas.ownerDocument?.createElement('canvas') ?? new OffscreenCanvas(32, 32)
  canvas.width = canvas.height = 32
  const paint = canvas.getContext('2d'), glow = paint.createRadialGradient(16, 16, 0, 16, 16, 16)
  glow.addColorStop(0, 'white')
  glow.addColorStop(.12, `hsl(${hue},100%,92%)`)
  glow.addColorStop(.28, `hsla(${hue},100%,65%,.8)`)
  glow.addColorStop(1, `hsla(${hue},100%,55%,0)`)
  paint.fillStyle = glow; paint.fillRect(0, 0, 32, 32)
  cache.set(hue, canvas)
  return canvas
}

export function drawMusicFireworks(ctx, bursts, now, width, height) {
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (const burst of bursts) {
    const age = Math.max(0, now - burst.at)
    const cx = width * burst.x, cy = height * burst.y
    const radius = Math.min(width * (burst.hand ? .16 : .21), burst.hand ? 46 : 62) * (.8 + burst.power * .2)
    // One short, bright ignition; the star then opens into fine moving streaks.
    const bloom = Math.max(0, 1 - age / .18)
    if (bloom > 0) {
      ctx.globalAlpha = bloom * .8
      const size = radius * .9
      ctx.drawImage(sparkSprite(ctx, burst.hue), cx - size / 2, cy - size / 2, size, size)
      ctx.strokeStyle = `hsla(${burst.hue},100%,90%,${bloom})`
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - 9 * bloom, cy); ctx.lineTo(cx + 9 * bloom, cy)
      ctx.moveTo(cx, cy - 9 * bloom); ctx.lineTo(cx, cy + 9 * bloom); ctx.stroke()
    }
    for (const spark of burst.sparks) {
      const life = FIREWORK_LIFETIME * spark.life
      if (age > life) continue
      const point = t => {
        const distance = radius * spark.speed * (1 - Math.exp(-t * 5))
        return [cx + Math.cos(spark.angle) * distance,
          cy + Math.sin(spark.angle) * distance + radius * .16 * t * t]
      }
      const [x, y] = point(age), [tx, ty] = point(Math.max(0, age - .09))
      const fade = (1 - age / life) ** 1.1
      const twinkle = age < .35 ? 1 : .7 + .3 * Math.sin(age * 23 + spark.phase) ** 2
      const hue = spark.speed > .8 ? burst.hue : burst.secondaryHue
      ctx.globalAlpha = fade
      ctx.strokeStyle = `hsla(${hue},100%,78%,.9)`
      ctx.lineWidth = spark.size * .85
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke()
      const size = 5 + spark.size * 2
      ctx.globalAlpha = fade * twinkle
      ctx.drawImage(sparkSprite(ctx, hue), x - size / 2, y - size / 2, size, size)
    }
  }
  ctx.restore()
}
