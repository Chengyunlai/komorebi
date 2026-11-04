// Moving between displays can change DPR without changing the CSS window size.
// Three.js remembers the startup ratio until we explicitly update it.
export function syncRendererPixelRatio(renderer, deviceRatio, minimum = 1) {
  const ratio = Math.min(3, Math.max(minimum, Number(deviceRatio) || 1));
  if (renderer.getPixelRatio() === ratio) return false;
  renderer.setPixelRatio(ratio);
  return true;
}
