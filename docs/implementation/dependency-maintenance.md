# 依赖维护 · 2026-11-03

## 问题与交付

首次 Dependabot 检查产生四个 PR。开发组混合了 Electron 小版本与 Vite 大版本；运行组混合 Pixi 6→8、unsafe-eval 6→7、图标库 0→1 与 Three.js 修订，安装产生 ERESOLVE。目标是逐项验证可接受更新，隔离有兼容约束的迁移。

## 更新策略

补丁与小版本按开发/运行分组，大版本单独提交。Electron 与 Three.js 始终独立：前者虽声明为开发依赖，实际承载桌面运行；后者 0.x 小版本也可能改变渲染行为。Live2D 0.4 明确依赖 Pixi 6，因此暂缓 pixi.js 与 unsafe-eval 大版本自动更新，保留同代补丁检查。迁移时需要配套修改 Live2D 集成，不绕过 peer dependency 约束。

Actions 继续 SHA 固定、独立升级，不启用自动合并。CI 验证测试/渲染器构建/原生编译；Package 另行验证上传、下载与解压；Electron/Vite/Three.js 需补实际运行验证。

## 证据与限制

事实：原 PR #4 在 npm ci 阶段失败，unsafe-eval 7 要求 core 7，而 Live2D 0.4 的 loaders/sprite 要求 core 6。原 PR #1–#3 CI 通过，但基于早期 main，且 CI 未执行 Electron 安装、启动或打包上传。

本轮已将原开发组 [#3](https://github.com/Chengyunlai/komorebi/pull/3) 拆为 [Electron #7](https://github.com/Chengyunlai/komorebi/pull/7)、[Vite #8](https://github.com/Chengyunlai/komorebi/pull/8)；原运行组 [#4](https://github.com/Chengyunlai/komorebi/pull/4) 拆为[图标 #9](https://github.com/Chengyunlai/komorebi/pull/9)、[Three.js #10](https://github.com/Chengyunlai/komorebi/pull/10)。Pixi 迁移见看板 MAINT-02。

处理结果：[#1](https://github.com/Chengyunlai/komorebi/pull/1) 与 [#2](https://github.com/Chengyunlai/komorebi/pull/2) 已合并；#3/#4 已关闭，由分别验证并合并的 #7–#10 接替。依赖策略与贡献说明通过 [#6](https://github.com/Chengyunlai/komorebi/pull/6) 整理。没有将不兼容 Pixi 组合或绕过依赖检查的安装方式合入 main。

本机隔离安装：Electron 45.2.1、Vite 8.3.5、Three.js 0.187.0 分别通过 238 项测试（237 通过、1 项缺少未分发日和素材而跳过）及渲染器构建。音乐桥与音频组件编译通过；隔离目录需指定独立 TMPDIR，避免原生构建脚本共用 CMake 缓存产生源路径冲突。

实机短时验证：每项在独立数据目录中启动 Electron，检查透明置顶窗口、VRM、本机动作库加载、原创节奏信号 active/tracking→off，无渲染/预加载错误；Vite 8 另完成 macOS 打包，并从打包后的 Resources/app 加载运行。音频 demo 静音，不改变用户正在播放的音乐；未据此声明系统采集权限或长期运行验收。角色、动作、截图和私有数据均未入库。

组合验证：从四项升级的合并内容重新 npm ci、测试、构建、安装 Electron 与打包；直接启动生成的 Komorebi.app（运行时 45.2.1），角色显示、窗口拖动、demo tracking→off 通过，无运行异常。图标独立验证在管理页读取到 15 个 Lucide SVG。官方 npm registry 的完整 npm audit 为 0 漏洞。各拆分 PR 在包含前项变更后重跑 Node22/24 与 macOS 原生 CI，通过后逐项合并。

产物验证：[Package 运行](https://github.com/Chengyunlai/komorebi/actions/runs/41614175847) 完成上传后下载、ZIP 逐字节比对、解压、执行权限/框架符号链接/入口/原生桥检查和 codesign 验证。本机下载 Azure 产物较慢，改由 GitHub runner 执行这些检查，并永久加入手动打包工作流；仅增加 actions:read 权限。该包仍为临时签名、未公证原型。

任何依赖检查结果均不代表 M1/M2 舞蹈或 M3 长期桌面体验验收；已选定的 30 秒演示继续作为当前观感参考。
