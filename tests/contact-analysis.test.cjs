const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../src/motion/contact-analysis.mjs');
function frame(left = [0, .12, 0], right = [.2, .12, 0]) {
  return { feet: { left, right }, hips: [0, 1, 0], rotations: {} };
}
test('stable shared support adapts to offset floor and does not invent a landing', async () => {
  const { analyzeFootContacts } = await load();
  const result = analyzeFootContacts(Array.from({ length: 30 }, () => frame()), { fps: 30 });
  assert.equal(result.frames.at(-1).support, 'both');
  assert.equal(result.diagnostics.groundHeight, .12);
  assert.equal(result.diagnostics.humanAnnotated, false);
  assert.deepEqual(result.landings, []);
});
test('lift and stable landing produce one event; raised stationary foot is not grounded', async () => {
  const { analyzeFootContacts } = await load();
  const frames = Array.from({ length: 60 }, (_, i) => frame([0, i >= 15 && i < 35 ? .32 : .12, 0]));
  const result = analyzeFootContacts(frames, { fps: 30 });
  assert.equal(result.frames[25].support, 'right');
  assert.equal(result.frames[50].support, 'both');
  assert.equal(result.landings.length, 1);
  assert.equal(result.landings[0].side, 'left');
  assert.ok(result.landings[0].frame >= 35 && result.landings[0].frame <= 39);
  const raised = analyzeFootContacts(Array.from({ length: 30 }, () => frame([0, .12, 0], [.2, .21, 0])));
  assert.equal(raised.frames.at(-1).support, 'left');
});
test('small capture jitter retains support without spurious landings', async () => {
  const { analyzeFootContacts } = await load();
  const result = analyzeFootContacts(Array.from({ length: 90 }, (_, i) => frame([.001 * (i % 2), .12 + .002 * (i % 2), 0])), { fps: 30 });
  assert.ok(result.frames.slice(5).every(f => f.support === 'both'));
  assert.equal(result.landings.length, 0);
});
test('missing or nonfinite feet are unknown, and recovery is not a landing', async () => {
  const { analyzeFootContacts } = await load();
  const frames = Array.from({ length: 20 }, () => frame());
  frames[8] = frame(null, [NaN, .12, 0]);
  const result = analyzeFootContacts(frames);
  assert.equal(result.frames[8].support, 'unknown');
  assert.equal(result.frames[8].left, null);
  assert.equal(result.frames[9].support, 'unknown');
  assert.equal(result.frames.at(-1).support, 'both');
  assert.equal(result.landings.length, 0);
  assert.equal(analyzeFootContacts([{}]).frames[0].support, 'unknown');
  assert.deepEqual(analyzeFootContacts([]).frames, []);
  assert.throws(() => analyzeFootContacts([], { fps: 0 }), TypeError);
});
test('fast ground-level translation is not stable support', async () => {
  const { analyzeFootContacts } = await load();
  const result = analyzeFootContacts(Array.from({ length: 20 }, (_, i) => frame([i * .1, .12, 0])), { fps: 30 });
  assert.equal(result.frames[10].support, 'right');
});
