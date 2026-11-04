const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { installAvatar } = require('../scripts/setup-avatar.cjs');
const { readVRM } = require('../electron/vrm-model.cjs');

function model(title) {
  const bones = ['hips', 'head', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm', 'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'];
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, extensions: { VRM: { meta: { title }, humanoid: { humanBones: bones.map(bone => ({ bone })) } } } }));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
  const header = Buffer.alloc(20); header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, padded]);
}
const script = path.resolve(__dirname, '../scripts/setup-avatar.cjs');

test('avatar command installs into the app lookup path, preserves existing avatars and validates before replacement', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'komorebi-avatar-')); t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const source = path.join(folder, 'downloaded model.vrm'), dataDir = path.join(folder, 'app data');
  fs.writeFileSync(source, model('first'));
  execFileSync(process.execPath, [script, source], { env: { ...process.env, KOMOREBI_DATA_DIR: dataDir } });
  const target = path.join(dataDir, 'local-models', 'Cute_Model.vrm');
  assert.equal(readVRM(target).info.title, 'first');
  fs.writeFileSync(source, model('second'));
  assert.throws(() => installAvatar(source, { dataDir }), /已有角色/);
  assert.equal(readVRM(target).info.title, 'first');
  execFileSync(process.execPath, [script, source, '--data-dir', dataDir, '--replace']);
  assert.equal(readVRM(target).info.title, 'second');
  fs.writeFileSync(source, '<html>login required</html>');
  assert.throws(() => installAvatar(source, { dataDir, replace: true }), /有效/);
  assert.equal(readVRM(target).info.title, 'second');
  assert.deepEqual(fs.readdirSync(path.dirname(target)), ['Cute_Model.vrm']);
});

test('avatar command gives the official source without claiming installation and reports invalid inputs', () => {
  const help = execFileSync(process.execPath, [script], { encoding: 'utf8' });
  assert.match(help, /https:\/\/booth.pm\/ja\/items\/7100270/);
  assert.match(help, /不会自动下载/);
  for (const args of [['--data-dir'], ['--replace'], ['--unknown'], ['model.vroid']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /角色未安装/);
  }
});
