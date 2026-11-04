# 角色下载与安装

源码和应用包都不附带角色。演示人物是 Jessair 的 **Cute Model**，作者允许免费下载、个人/商业使用及修改，但禁止再分发、转卖、NFT 和 AI 训练。因此不能将该文件放进 GitHub、安装包或项目自己的下载镜像。使用或展示时请署名 Jessair；其他角色遵循各自作者的许可。

## 下载

打开[作者的 BOOTH 页面](https://booth.pm/ja/items/7100270)，登录并阅读条款，下载 **Cute_Model.vrm**。`.vroid` 是 VRoid 编辑工程，无法直接导入。2026-11-04 核验时该资源免费，点击 VRM 下载会进入 BOOTH 登录页；页面或条款变更时以作者当前说明为准。

安装 AI 应主动展示作者链接和下面的命令。用户完成登录、下载后，可由 AI 安装其本机文件；没有文件时明确报告角色尚未安装。安装脚本只处理本机文件，不登录 BOOTH，也不下载或上传资源。

## 命令安装

先退出 Komorebi，再从项目根目录运行：

```sh
npm run setup:avatar -- "$HOME/Downloads/Cute_Model.vrm"
npm start
```

可传入其他已获使用许可的 `.vrm`。安装器复用应用的 VRM 校验：最大 64MB、GLB 结构、全身骨骼、无外部资源引用；通过后原子写入 `~/Library/Application Support/Komorebi/local-models/Cute_Model.vrm`。这是应用的统一查找文件名，不要求所有角色都叫 Cute Model。结构校验不等于视觉效果验收。

默认保留已有角色并报错。确定要更换时：

```sh
npm run setup:avatar -- "/absolute/path/to/another.vrm" --replace
```

自定义数据目录须与启动应用的目录一致：

```sh
npm run setup:avatar -- "$HOME/Downloads/Cute_Model.vrm" --data-dir "/absolute/path/to/app-data"
KOMOREBI_DATA_DIR="/absolute/path/to/app-data" npm start
```

安装器也读取 `KOMOREBI_DATA_DIR`，显式 `--data-dir` 优先。默认目录安装面向 macOS；其他平台可用自定义目录验证写入，但不表示桌面集成已适配。无参数或 `--help` 只显示指引，不执行安装。无效文件、缺失文件或已有角色返回非零退出码，不改写现有模型。

## 图形界面安装与验收

从托盘打开“配置与管理 → 偏好设置 → 桌面角色 → 导入角色”，选择 `.vrm`。图形界面会重新加载桌宠；命令安装后需自行重新启动应用。

验收时确认透明窗口内可见角色、待机和拖动正常；音乐响应另按[使用说明](usage.md)验证。只有命令成功或程序能启动，还不足以证明特定角色显示正常。许可出处见[第三方说明](../THIRD-PARTY-NOTICES.md)，实现和验证见[安装器记录](implementation/avatar-setup.md)。
