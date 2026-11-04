const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const { readVRM } = require('../electron/vrm-model.cjs');

const help = `角色尚需单独安装；本命令不会自动下载。
演示角色：Cute Model / Jessair（免费）
官方下载：https://booth.pm/ja/items/7100270
请登录 BOOTH，阅读作者条款并下载 Cute_Model.vrm（不是 .vroid）。
作者允许个人/商业使用，禁止再分发、转卖、NFT 和 AI 训练；使用/展示时请署名 Jessair。

下载后，在项目根目录运行：
  npm run setup:avatar -- "$HOME/Downloads/Cute_Model.vrm"
也可传入其他有使用许可的本机 .vrm。

选项：
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
  let source, dataDir = process.env.KOMOREBI_DATA_DIR || undefined, replace = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--replace') replace = true;
    else if (arg === '--data-dir') {
      dataDir = args[++i];
      if (!dataDir || dataDir.startsWith('--')) throw Error('--data-dir 需要目录。');
    } else if (arg.startsWith('--')) throw Error(`未知选项：${arg}`);
    else if (source) throw Error('一次只能安装一个 .vrm 文件。');
    else source = arg;
  }
  if (!source) throw Error('请提供已下载的 .vrm 路径；运行 npm run setup:avatar 查看官方下载说明。');
  const result = installAvatar(source, { dataDir, replace });
  console.log(`角色已安装：${result.destination}\nVRM ${result.info.version} · ${result.info.title}\n请重新启动 Komorebi。角色文件仅保存在本机，不会加入源码。`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`角色未安装：${error.message}`); process.exitCode = 1; }
}
module.exports = { installAvatar };
