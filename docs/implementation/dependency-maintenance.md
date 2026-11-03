# 依赖维护 · 2026-11-03

## 问题与交付

首次 Dependabot 检查产生四个 PR。开发组混合了 Electron 小版本与 Vite 大版本；运行组混合 Pixi 6→8、unsafe-eval 6→7、图标库 0→1 与 Three.js 修订，安装产生 ERESOLVE。目标是逐项验证可接受更新，隔离有兼容约束的迁移。

## 更新策略

补丁与小版本按开发/运行分组，大版本单独提交。Electron 与 Three.js 始终独立：前者虽声明为开发依赖，实际承载桌面运行；后者 0.x 小版本也可能改变渲染行为。Live2D 0.4 明确依赖 Pixi 6，因此暂缓 pixi.js 与 unsafe-eval 大版本自动更新，保留同代补丁检查。迁移时需要配套修改 Live2D 集成，不绕过 peer dependency 约束。

Actions 继续 SHA 固定、独立升级，不启用自动合并。CI 验证测试/渲染器构建/原生编译；Package 另行验证上传、下载与解压；Electron/Vite/Three.js 需补实际运行验证。

## 证据与限制

事实：原 PR #4 在 npm ci 阶段失败，unsafe-eval 7 要求 core 7，而 Live2D 0.4 的 loaders/sprite 要求 core 6。原 PR #1–#3 CI 通过，但基于早期 main，且 CI 未执行 Electron 安装、启动或打包上传。

本轮执行结果随验证补充。任何依赖检查结果均不代表 M1/M2 舞蹈或 M3 长期桌面体验验收；已选定的 30 秒演示继续作为当前观感参考。
