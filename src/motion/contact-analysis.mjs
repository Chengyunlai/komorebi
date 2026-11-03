const SIDES = ['left', 'right'];
const validPoint = p => p != null && p.length >= 3 && [p[0], p[1], p[2]].every(Number.isFinite);
const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * q)];
};
const distance = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));

/**
 * Automatic kinematic estimates, NOT human contact annotations or force measurements.
 * Input feet are world positions in metres (Y up); hips/rotations are left untouched.
 * true = estimated contact, false = estimated airborne/moving, null = unknown.
 * A landing requires an observed airborne -> stable contact transition; clip starts
 * and data-gap recovery do not count. This offline estimate assumes a level floor.
 */
export function analyzeFootContacts(frames, { fps = 15 } = {}) {
  if (!Array.isArray(frames) || !Number.isFinite(fps) || fps <= 0) {
    throw new TypeError('frames must be an array and fps must be positive');
  }
  const points = frames.map(frame => Object.fromEntries(SIDES.map(side => [side,
    validPoint(frame?.feet?.[side]) ? Array.from(frame.feet[side]).slice(0, 3) : null])));
  const heights = points.flatMap(p => SIDES.flatMap(side => p[side] ? [p[side][1]] : []));
  // A shared floor prevents a permanently raised foot from defining its own floor.
  const groundHeight = quantile(heights, .08);
  const hipDistances = frames.flatMap((frame, i) => validPoint(frame?.hips)
    ? SIDES.flatMap(side => points[i][side] ? [Math.abs(frame.hips[1] - points[i][side][1])] : []) : []);
  const measuredScale = quantile(hipDistances.filter(v => v > .05), .5);
  const legScale = measuredScale ?? .8;
  const heightEnter = Math.max(.008, legScale * .035);
  const heightExit = heightEnter * 1.8;
  const speedEnter = Math.max(.06, legScale * .22);
  const speedExit = speedEnter * 1.8;
  const dwellFrames = Math.max(2, Math.ceil(fps * .06));
  const states = { left: null, right: null };
  const dwell = { left: 0, right: 0 };
  const landings = [];
  const output = points.map((p, i) => {
    const contact = {};
    for (const side of SIDES) {
      const previous = points[i - 1]?.[side], next = points[i + 1]?.[side];
      // Never bridge a gap: velocity over missing observations is not evidence.
      if (!p[side] || (!previous && !next) || (i > 0 && !previous) || (i < points.length - 1 && !next)) {
        contact[side] = null; states[side] = null; dwell[side] = 0; continue;
      }
      // Central differences reject small alternating capture jitter without smoothing
      // across an actual missing frame. Height remains unsmoothed for lift detection.
      const speed = previous && next ? distance(previous, next) * fps / 2
        : distance(p[side], previous || next) * fps;
      const height = p[side][1] - groundHeight;
      const stable = height <= heightEnter && speed <= speedEnter;
      const released = height > heightExit || speed > speedExit;
      if (released) { states[side] = false; dwell[side] = 0; }
      else if (stable) {
        dwell[side]++;
        if (dwell[side] >= dwellFrames) {
          if (states[side] === false) landings.push({ frame: i, side });
          states[side] = true;
        }
      } else dwell[side] = 0;
      contact[side] = states[side];
    }
    const { left, right } = contact;
    const support = left === null || right === null ? 'unknown'
      : left && right ? 'both' : left ? 'left' : right ? 'right' : 'none';
    return { left, right, support };
  });
  return {
    frames: output, landings,
    diagnostics: {
      method: 'automatic-estimate', humanAnnotated: false, groundHeight, legScale,
      scaleSource: measuredScale === null ? 'fallback' : 'hips-to-feet',
      floors: Object.fromEntries(SIDES.map(side => [side, quantile(points.flatMap(p => p[side] ? [p[side][1]] : []), .08)])),
      thresholds: { heightEnter, heightExit, speedEnter, speedExit, dwellFrames },
      unknownFrames: output.filter(frame => frame.support === 'unknown').length,
      assumptions: ['world-metres-y-up', 'level-floor', 'kinematic-contact-not-force'],
    },
  };
}
