const test = require('node:test');
const assert = require('node:assert/strict');
async function press(overrides = {}, composing = false) {
  const { handleTaskKeydown } = await import('../src/task-input.js');
  const effects = { sent: 0, prevented: false, stopped: false };
  handleTaskKeydown({ key: 'Enter', ...overrides,
    preventDefault() { effects.prevented = true; },
    stopPropagation() { effects.stopped = true; }
  }, () => effects.sent++, composing);
  return effects;
}
test('Enter sends once and prevents a stray newline', async () => {
  assert.deepEqual(await press(), { sent: 1, prevented: true, stopped: true });
});
test('Shift+Enter remains a native newline', async () => {
  assert.deepEqual(await press({ shiftKey: true }), { sent: 0, prevented: false, stopped: false });
});
test('IME confirmation never sends the composing text', async () => {
  for (const result of [await press({ isComposing: true }), await press({ keyCode: 229 }), await press({}, true)]) {
    assert.equal(result.sent, 0); assert.equal(result.prevented, false);
  }
});
test('Holding Enter does not repeat submission or insert newlines', async () => {
  assert.deepEqual(await press({ repeat: true }), { sent: 0, prevented: true, stopped: true });
});
