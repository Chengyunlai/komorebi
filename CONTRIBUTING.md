# 贡献指南 / Contributing

欢迎中文或 English 的 issue、文档改进和 PR。先描述用户遇到的问题和预期效果，涉及较大行为变化时先开 issue 对齐范围。

## 开始开发

1. 读 [README](README.md) → [上下文](docs/context.md) → [examples](examples/README.md) → 对应实现记录；当前优先级见 [BACKLOG](docs/project/BACKLOG.md)。
2. 使用 Node 22.13+，`npm ci` 后运行 `npm run verify`。本机启动前另运行 `npm run setup:electron` 安装 Electron 运行时。音乐原生集成需要 macOS、Xcode Command Line Tools 和 CMake。
3. 选一个相关 example，先运行 `user_code`，再读 `core`。例子统一放在 `examples/`。

| 目录 | 负责内容 |
| --- | --- |
| `electron/` | 系统窗口、IPC、任务后端、SQLite、音乐桥接与采集 |
| `src/` | Vue 界面、角色与音乐面板 |
| `src/motion/` | 动作决策、规划、混合与身体执行 |
| `src/motion-lab/` | 独立研究与回放界面 |
| `examples/`、`tests/` | 可运行示例、合成夹具与回归验证 |
| `docs/` | 当前设计、实现记录与项目管理 |
| `vendor/`、`src/vendor/`、`electron/vendor/` | 保留来源与许可的第三方代码 |

## 提交与验证

- 每个 PR 聚焦一个问题，说明触发条件、行为变化、验证结果和限制；附关联 issue（如有）。不要求签署 CLA。
- 逻辑改动用能覆盖行为的测试；UI/动作变化补充实际回放或截图证据，标注机器、素材许可和未验证项。只改文案无需机械新增测试。
- `npm run verify` 通过后，`git add` 拟提交文件，再运行 `npm run check:release` 检查索引。音频/打包变更还应运行相应 macOS 原生构建。
- 公开 API、目录、入口改变时同步 examples 索引、上下文和实现记录。历史 Stage 是研究记录，不是整体完成率。
- 音乐信号和动作决策保持分离；优先使用已 vendor 的音乐接口。升级信号模块用 `scripts/sync-music-signal.cjs` 并保留 provenance，不建立第二份维护分支。
- 区分事实、假设和验收维度。工程问题须对应音乐信息、身体能力或舞蹈知识的接口缺口。自动测试不能替代完整舞段观感验收。

## 素材、隐私与许可

禁止提交密钥、用户资料、录音、真实歌曲、其他角色文件、BVH、模型权重或未经授权的派生动作。唯一角色例外是已核验并获用户同意分发的 `assets/avatars/sendagaya-shino/Sendagaya_Shino.vrm`（pixiv，CC0），更新时须同时维护来源、许可与校验和。使用合成夹具验证。`public/vendor/` 与 `docs/evidence/` 下本机研究产物默认不入库；不要强制添加它们。新增第三方代码需保留完整许可、来源和修订，并更新 THIRD-PARTY-NOTICES。

提交贡献即同意将自己的贡献按本仓库 MIT 许可发布，第三方内容仍遵守其原许可。

## CI 与分发

PR/push 执行测试、渲染器构建与 macOS 原生编译。依赖按月检查：补丁与小版本按开发/运行依赖分组，大版本单独提 PR；Electron 与 Three.js 始终单独升级。Electron 虽位于 devDependencies，仍须验证桌面启动、透明窗口和音频链路；Vite 大版本须补打包后运行验证。Live2D 0.4 所需 Pixi 6 与 unsafe-eval 6 保持配套，大版本迁移单独处理，不能用 `--force` 或 `--legacy-peer-deps` 绕过冲突。

Actions 升级需验证实际受影响的工作流；普通 CI 通过不能代替手动 Package 的产物上传、下载与解压验证。手动 Package 工作流只产生内部试用包，不自动上传 Release；不要把无签名/未公证产物描述为正式发布。依赖维护记录见[实现记录](docs/implementation/dependency-maintenance.md)。

## English quick guide

Read README → context → examples → the relevant implementation note. Run `npm ci` and `npm run verify`; stage intended files, then run `npm run check:release`. Keep PRs focused and include validation and limitations. Native music integration needs macOS, Xcode CLI tools and CMake. Use synthetic fixtures; never commit private data, keys, recordings, character assets, research motion or model weights. Preserve third-party notices. Document API/path changes. Visual dance acceptance is separate from passing tests. Contributions are licensed under MIT, subject to third-party terms.

Group only minor/patch dependency updates; review major upgrades separately. Electron and Three.js always get separate PRs. Keep Pixi 6 and unsafe-eval 6 together until the Live2D integration is migrated; do not bypass peer conflicts. Electron/Vite upgrades need an application smoke check. Actions upgrades must exercise the affected workflow, including downloading and extracting packaging artifacts.
