const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { readVRM, bundledAvatar } = require('../electron/vrm-model.cjs');

const help = `Komorebi 已内置千驮谷筱 / Sendagaya Shino（pixiv，CC0）。
首次启动自动显示，无需登录或另行下载；已有导入角色优先使用。
来源与许可：https://vroid.pixiv.help/hc/en-us/articles/360013482714-Sendagaya-Shino
本命令不会自动下载。

更换为其他有使用许可的本机 .vrm：
  npm run setup:avatar -- "/absolute/path/to/model.vrm"
换回内置角色：
  npm run setup:avatar -- --default --replace

旧演示使用 Jessair Cute Model（免费但禁止再分发，未附带）：
https://booth.pm/ja/items/7100270 （需自行登录下载 Cute_Model.vrm，不是 .vroid）

选项：
  --default          安装随应用提供的千驮谷筱
  --replace          替换已有角色（默认保留已有角色并报错）
  --data-dir <目录>  自定义应用数据目录，等同 KOMOREBI_DATA_DIR
  --help             显示本说明

默认写入 macOS 的 ~/Library/Application Support/Komorebi/local-models/Cute_Model.vrm。
安装前退出 Komorebi，安装后重新启动；也可在“偏好设置 → 桌面角色”导入。
`;

function installAvatar(source, { dataDir, replace = false } = {}) {
  if (!dataDir && process.platform !== 'darwin') throw Error('默认桌面安装仅支持 macOS；测试或自定义目录请传 --data-dir。');
  if (path.extname(source).toLowerCase() !== '.vrm') throw Error('请选择 .vrm 文件；.vroid 是编辑工程，不能直接使用。');
  const resource = readVRM(path.resolve(source));
  if (!resource) throw Error('角色文件不存在；请先从作者页面下载 .vrm。');
  const folder = path.resolve(dataDir || path.join(os.homedir(), 'Library', 'Application Support', 'Komorebi'), 'local-models');
  const destination = path.join(folder, 'Cute_Model.vrm');
  fs.mkdirSync(folder, { recursive: true });
  const temporary = path.join(folder, `.avatar-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, resource.bytes, { flag: 'wx', mode: 0o600 });
    // Publish only a fully validated file. linkSync atomically refuses an existing avatar.
    if (replace) fs.renameSync(temporary, destination);
    else fs.linkSync(temporary, destination);
  } catch (error) {
    if (error.code === 'EEXIST') throw Error('已有角色，未修改。确认替换后加 --replace，或在偏好设置中导入。');
    throw error;
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return { destination, info: resource.info };
}

function main(args) {
  if (!args.length || args.includes('--help')) { console.log(help); return; }
  let source, useDefault = false, dataDir = process.env.KOMOREBI_DATA_DIR || undefined, replace = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--replace') replace = true;
    else if (arg === '--default') useDefault = true;
    else if (arg === '--data-dir') {
      dataDir = args[++i];
      if (!dataDir || dataDir.startsWith('--')) throw Error('--data-dir 需要目录。');
    } else if (arg.startsWith('--')) throw Error(`未知选项：${arg}`);
    else if (source) throw Error('一次只能安装一个 .vrm 文件。');
    else source = arg;
  }
  if (useDefault && source) throw Error('--default 不能与本机文件路径同时使用。');
  if (useDefault) source = bundledAvatar;
  if (!source) throw Error('请提供本机 .vrm 路径或 --default；运行 npm run setup:avatar 查看说明。');
  const result = installAvatar(source, { dataDir, replace });
  console.log(`角色已安装：${result.destination}\nVRM ${result.info.version} · ${result.info.title}\n请重新启动 Komorebi。角色文件仅保存在本机，不会加入源码。`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`角色未安装：${error.message}`); process.exitCode = 1; }
}
module.exports = { installAvatar };
