# 默认角色与更换角色

Komorebi 已内置 **千驮谷筱 / Sendagaya Shino**（pixiv / VRoid Project，CC0）。首次启动无需登录、下载或导入；模型随源码及应用包提供，运行时不访问下载服务。来源与完整许可见[角色资源目录](../assets/avatars/sendagaya-shino/)。

已有 `local-models/Cute_Model.vrm` 的用户继续使用其自行导入角色；此固定文件名是历史兼容路径，不要求角色名为 Cute Model。

## 更换角色

从托盘打开“配置与管理 → 偏好设置 → 桌面角色 → 导入角色”，选择有使用许可的 `.vrm`，应用会重新加载桌宠。`.vroid` 是编辑工程，不能直接导入。

也可退出 Komorebi，在项目根目录运行：

```sh
npm run setup:avatar -- "/absolute/path/to/model.vrm"
npm start
```

默认保留已有导入文件并报错。确定更换时加 `--replace`；换回内置角色无需下载：

```sh
npm run setup:avatar -- --default --replace
npm start
```

命令校验最大 64MB、GLB 结构、全身骨骼及无外部资源引用，然后原子写入 `~/Library/Application Support/Komorebi/local-models/Cute_Model.vrm`。`--default` 使用仓库内置文件，不联网；命令成功后需重新启动应用。无参数或 `--help` 仅显示说明，不执行安装。

自定义数据目录须与启动应用一致：

```sh
npm run setup:avatar -- --default --data-dir "/absolute/path/to/app-data"
KOMOREBI_DATA_DIR="/absolute/path/to/app-data" npm start
```

安装器也读取 `KOMOREBI_DATA_DIR`，显式 `--data-dir` 优先。无效文件、缺失文件、冲突参数或已有角色返回非零退出码，不改写现有模型。默认目录面向 macOS；其他平台可用自定义目录验证文件安装，不表示桌面集成已适配。

## AI 安装约定

新安装直接启动并确认默认角色可见，不再要求用户另外下载。只在用户指定其他角色时引导其取得授权文件。结构校验不能替代实际显示验收；确认完整角色、待机、拖动正常，音乐另按[使用说明](usage.md)验证。

README 旧演示仍使用 Jessair Cute Model，该文件禁止再分发，未附带。如果用户指定该角色，提供[作者 BOOTH 页面](https://booth.pm/ja/items/7100270)，由用户登录、阅读条款并下载 `Cute_Model.vrm`，之后按上述命令或偏好设置导入；不绕过登录或重新托管。其个人/商业、再分发、NFT 和 AI 训练限制以作者当前条款为准。

实现与验证见[默认角色记录](implementation/default-avatar.md)、[安装器原始记录](implementation/avatar-setup.md)。
