# 开源分发边界（2026-11-03）

自有代码适用根目录 MIT LICENSE；以下第三方内容保留原许可。本文的历史素材说明用于追溯本机实验，不表示公开源码包含相应素材。

- `public/vendor/`（Live2D 日和与 Cubism Core）、所有用户 VRM/BVH、研究派生动作、音乐、权重和本机证据均不在公开快照中。
- 默认 VRM 待机后备 `src/motion/default-idle.mjs` 为本项目原创。若用户自行安装日和动作，解释该动作仍受其原素材许可约束。
- `scripts/bailando-stream-server.py` 是可选 Motius/Bailando 研究适配，包含经 Motius 改编的 Bailando 自回归采样流程，**不适用根目录 MIT**。该研究脚本按上游 S-Lab License 1.0 限非商业用途，完整条款见 `docs/licenses/Bailando-S-Lab-LICENSE.txt`；修改包括温度采样与流式对接。来源：https://github.com/lisiyao21/Bailando 、https://github.com/ZeyuLing/Motius 。Motius、Bailando、AIST++、SMPL 与模型权重的条款需单独核对，源码 MIT 不授予它们的使用权。不随包附框架或权重，也不默认下载。
- 本机 stage-44 动作库来自 tulay-hub/dance-dataset；即使上游仓库声明 MIT，本项目不据此重新分发其中动作或派生帧，使用者应自行核实素材权利。
- README 封面为 AI 生成的原创品牌插画，不代表已提供角色资产或应用截图。

## README 实机演示视频

用户确认更新的 40 秒演示附件：https://github.com/user-attachments/assets/663b17d3-a19e-47e1-b2c2-a4897273cd81 。视频为本机实际桌宠窗口与播放声音的录制，未将角色文件或歌曲文件加入源码；附件本身不适用源码 MIT 许可。演示使用 Jessair 的 Cute Model（下文提供来源）与 Black Eyed Peas《Boom Boom Pow》，角色和音乐权利仍归各自权利人。公开视频不构成对角色、音乐或动作素材的再授权。

# 第三方来源与许可

## 音乐播放桥接

CloudPlatter：https://github.com/Chengyunlai/cloud-platter ，参考修订 7e797a061c80d189ccba9d2fe8515cea1140c7ef，MIT，Copyright 2026 Chengyunlai。参考其通过隔离 Perl 进程读取 MediaRemote 并按网易云 bundle 过滤的路线；未复制其界面、图标或 JXA 后备代码。许可保留于 docs/licenses/cloud-platter-LICENSE.txt。

mediaremote-adapter：https://github.com/ungive/mediaremote-adapter ，修订 3ac3d4bdf862c7b5399b4fba4df5689f5c38609a，BSD-3-Clause。完整原始源码保留于 vendor/mediaremote-adapter，编译的 framework、Perl 脚本和 LICENSE 保留于 native/mediaremote。许可另见 docs/licenses/mediaremote-adapter-LICENSE.txt。构建仅生成媒体桥接组件，不运行其模拟 Now Playing 的测试命令。

网易云客户端、音乐及歌词不适用本项目源码许可；本应用不打包音乐与实际歌词。歌词接口请求为独立实现，未复制第三方网易云 API 服务。

## Project AIRI

仓库：https://github.com/moeru-ai/airi

参考修订：dfd9453beaab3af43a40f9bdacebdcb0d51f2723。

实际复用 `packages/model-driver-lipsync/src/live2d/index.ts` 和 `shared/wlipsync/profile.json`，保存在 `src/vendor/`。MIT 许可证原文保存在 `src/vendor/AIRI-LICENSE`，应用包另保留 `docs/licenses/AIRI-LICENSE.txt`。AIRI 的完整桌面应用和 workspace 没有被直接 fork 或打包。

AIRI 的 Electron 构建脚本提供 Hiyori 示例模型下载地址，本原型使用相同资源。MiMo 请求格式也核对了 `packages/provider-inference/src/providers/cloud/mimo-audio/index.ts`。

## Live2D

桃濑日和 FREE，插画 Kani Biimu，建模 Live2D。© Live2D Inc.。原始说明保存在 `public/vendor/hiyori_free_zh/ReadMe.txt`，构建产物保留同一文件。

原始下载：https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip

模型、角色和 Cubism Core 不适用本应用源码的开源许可。示例素材条款：https://www.live2d.com/en/terms/live2d-free-material-license-agreement/

Cubism Core 来自官方 https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js ，文件头保留版权声明与专有软件许可链接。SDK 发布条款：https://www.live2d.com/en/sdk/license/

本交付为本地原型。公开发行、商用或增加用户自定义模型导入前需重新核对对应条款。

## 运行依赖

Electron、Vue、Vite、PixiJS、pixi-live2d-display、wLipSync、Lucide 的版本锁定于 package-lock.json。原始许可证保留在安装依赖中。Electron 应用包保留 Electron 的 LICENSE 与 LICENSES.chromium.html。

## 交互和协议参考

- YumYum Agent：https://github.com/kyu91/yumyum-agent ，Apache 2.0。参考交办草稿与结果回收流程，未复制其 Swift 源码。
- Desktop Companion：https://github.com/xShiroeNguyenx/desktop-companion 。参考划选交互；未复制素材与自动划选代码。
- Agent Paperclip：https://github.com/fredruss/agent-paperclip 。参考任务状态区分；没有读取其状态文件或复制形象。
- Codex 非交互文档：https://learn.chatgpt.com/docs/non-interactive-mode 。当前实现读取 CLI 的 JSONL 事件，只显示最终回答和必要进度，不显示推理原文。
- 小米 MiMo：https://mimo.mi.com/models/en-US/mimo-v2.5-tts 。调用 chat/completions 并读取 message.audio.data。


## 独立音乐信号项目

Chengyunlai/music-signal-lab v0.1.0：自有独立项目（上游目前私有）；本仓库内自有算法副本按根目录 MIT 发布，算法与通用动作控制副本位于electron/vendor/music-signal和src/vendor/music-signal，revision见各自provenance.json。未复制模型素材进入该仓库；生产核心没有使用研究vendor/tempora。

原生音频采集依据Apple Core Audio taps官方API实现，并参考AudioTee的进程过滤与tap/aggregate接入路线（https://github.com/makeusabrew/audiotee，修订56ac954369a09318e46b88a6eec33c2d2b0d32a3，README声明MIT，Copyright 2025 Nick Payne）；未复制其源文件。

Laya (NandhaKishorM/laya), Apache-2.0: optional local decision engine, installed separately through pip. Source: https://github.com/NandhaKishorM/laya . Checkpoint licenses follow their Hugging Face model cards; checkpoint weights are not distributed in this app.

## VRM 预览

Three.js 与 @pixiv/three-vrm 使用MIT许可，锁定版本见package-lock.json。项目：https://github.com/mrdoob/three.js 、https://github.com/pixiv/three-vrm 。许可文本随应用保存在docs/licenses。

Cute Model，作者Jessair，https://booth.pm/ja/items/7100270 。用户自行下载，仅存本机userData/local-models。允许个人/商业使用与改造，禁止再分发、转卖及AI训练；不随本应用、源码与压缩包提供。不是项目独占原创人物。研究舞蹈依旧仅本机CC BY-NC4.0参考。

VRM默认待机由已包含的Live2D日和hiyori_m05.motion3.json曲线在本机解释映射，来源©Live2D Inc.及原作者，继续适用原示例素材许可；不是重新授予该动作MIT授权。原始素材文件未修改。VRM角色素材仍仅用户本机使用。

## 本机动作库实验（stage-12）
仅用户本机现有Bandai Namco Research BVH（CC BY-NC 4.0）会在内存中重定向和分片。原始BVH和派生姿态均不打包。本模块独立实现，未复制Bailando、EDGE或Motion Matching项目代码或权重。研究参考：https://graphics.cs.wisc.edu/Papers/2002/KGP02/ 、https://github.com/orangeduck/Motion-Matching 。公开或商业分发动作库前需另取得合适授权。
