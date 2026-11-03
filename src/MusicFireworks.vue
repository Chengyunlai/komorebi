<script setup>
import {ref, watch, onMounted, onBeforeUnmount} from 'vue'
import {selectFireworkHand} from './effects/character-anchors.mjs'
import {createMusicFireworks, drawMusicFireworks} from './effects/music-fireworks.mjs'

const props = defineProps({audio: Object, readAnchors: Function, enabled: {type: Boolean, default: true}})
const canvas = ref(null)
const fireworks = createMusicFireworks()
let previousAnchors = null
let ctx, observer, reduced, raf = 0, width = 0, height = 0, ratio = 1
function render(now) {
  raf = 0
  fireworks.advance(now / 1000)
  drawMusicFireworks(ctx, fireworks.bursts, now / 1000, width, height)
  if (fireworks.bursts.length) raf = requestAnimationFrame(render)
}
function clear() {
  cancelAnimationFrame(raf); raf = 0
  fireworks.clear()
  previousAnchors = null
  ctx?.clearRect(0, 0, width, height)
}
function receive() {
  if (!ctx) return
  if (!props.enabled || reduced.matches || document.hidden) { clear(); return }
  const now = performance.now()
  fireworks.advance(now / 1000)
  const anchors = props.readAnchors?.()
  const origin = selectFireworkHand(anchors, canvas.value.getBoundingClientRect(), now / 1000, previousAnchors)
  previousAnchors = anchors
  const fired = fireworks.observe({signal: props.audio?.signal, mode: props.audio?.mode,
    age: Number.isFinite(props.audio?.receivedAt) ? (now - props.audio.receivedAt) / 1000 : Infinity,
    now: now / 1000, origin, requireOrigin: true})
  if (fired) {
    const burst = fireworks.bursts.at(-1)
    // Small diagnostics for actual-window checks, without storing body tracks.
    Object.assign(canvas.value.dataset, {fireworkOrigin: burst.side, fireworkX: String(burst.x),
      fireworkY: String(burst.y), fireworkAt: String(burst.at), fireworkReason: burst.reason})
  }
  if (fireworks.bursts.length && !raf) raf = requestAnimationFrame(render)
}
function resize() {
  const bounds = canvas.value.getBoundingClientRect()
  width = bounds.width; height = bounds.height
  ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(width * ratio)
  canvas.value.height = Math.round(height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
}
function motionChanged() { if (reduced.matches) clear() }
function visibilityChanged() { if (document.hidden) clear() }
watch(() => [props.audio, props.enabled], receive)
onMounted(() => {
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced.addEventListener('change', motionChanged)
  document.addEventListener('visibilitychange', visibilityChanged)
  observer = new ResizeObserver(resize); observer.observe(canvas.value)
  resize(); receive()
})
onBeforeUnmount(() => {
  clear(); observer?.disconnect()
  reduced?.removeEventListener('change', motionChanged)
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template><canvas ref="canvas" class="music-fireworks" aria-hidden="true"/></template>

<style scoped>
.music-fireworks{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
</style>
