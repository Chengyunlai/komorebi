# 音乐陪伴动作调研与改造路线

调研日期：2026-10-28。范围：当前应用源码、Live2D 官方 SDK/Editor 文档、AIRI 源码、VTube Studio 开发者文档、Open-LLM-VTuber 文档、Apple 音频采集文档。本轮完成调查和方案，运行版未修改。网页和代码调查不等于已在本机验收上游完整效果。

## 结论

推荐保留当前 Electron/Vue/Live2D，改为“分层动作控制 + 节拍触发 + 模型专属动作素材”。先修正更新时序和动作编排，再接真实音频节拍。CloudPlatter 的播放状态桥继续负责曲目、暂停、进度、歌词同步，不承担音频节拍分析。

AIRI 的动作目标编排和弹簧跟随最值得复用；VTube Studio 的参数控制权和渐变接管机制值得参考。官方提供动作、物理、混合工具，不会自动为任意模型生成舞蹈。

## 当前实现为什么显得呆

1. src/music-view.js:12 的 dancePose 是固定节奏的短周期正弦组合。头部5、身体3、点头2、手臂0–5的幅度均为硬编码参数偏移，不代表模型最终屏幕角度。没有重拍、动作段落或音乐能量。
2. src/Character.vue:70 把舞动挂在 beforeModelUpdate。当前 pixi-live2d-display 0.4.0 的实际顺序为 motion → saveParameters → expression/blink/focus/breath → physics → pose → beforeModelUpdate → model.update → loadParameters。音乐偏移发生在 physics 之后，本帧头发和裙摆无法响应这部分输入；偏移随后被 loadParameters 清除，也不会在下一帧补进物理。原有 Idle 本身的物理仍正常，不能说整个模型没有物理。
3. head/body/arms 各自周期叠加，缺少“身体先转移重心，头部跟随，手臂稍后到达”的动作因果。2.2px整人上移使脚也离地，只能表现轻微漂浮，不能代替屈膝和重心变化。
4. 强度每帧固定插值0.12，恢复速度随帧率变化。应使用按真实dt计算的衰减或稳定弹簧；时间轴跳转需要相位重设与混合，不能瞬移姿势。
5. Hiyori资源包含8份motion，其中Idle组三份，其余为Flick/Tap相关动作。它们不是音乐舞蹈素材。公开参数包含头、身体、双臂、眼口、发饰、裙摆等，但未暴露独立髋、膝、足控制；当前资源不能靠增加一个参数名就获得迈步、踢腿能力。MOC3内部完整绑定范围未通过编辑器源工程进一步核验。

## 官方路线

- [Live2D Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)：官方示例先处理主要动作、表情、视线与呼吸，再计算物理，随后口型和最终模型更新。加法层必须建立可恢复的基准，防止逐帧累加。
- [Live2D About Motion](https://docs.live2d.com/en/cubism-sdk-manual/motion/)：motion3支持关键帧动作、循环、整体和参数级淡入淡出、优先级；并行控制同一参数可能互相覆盖。应明确参数归属，而非不断叠加多个动画源。
- [Live2D Creating Animations](https://docs.live2d.com/en/cubism-editor-tutorials/animator/)：在Cubism Editor动画时间轴、曲线编辑器中制作动作并导出运行用motion。可先为当前模型制作听歌循环，扩大到全身舞蹈时再补绑定/换模型。

## 可复用项目

### AIRI：最贴近本需求的节拍动作

已读取源码修订 dfd9453beaab3af43a40f9bdacebdcb0d51f2723，不依赖第三方介绍推断能力。

- [beat-sync.ts](https://github.com/moeru-ai/airi/blob/dfd9453beaab3af43a40f9bdacebdcb0d51f2723/packages/stage-ui-live2d/src/composables/live2d/beat-sync.ts)：节拍时间触发动作段，提供punchy-v、balanced-v、swing-lr、sway-sine四种目标轨迹，分段easeOutCubic衔接；可根据平滑的拍间隔选择风格，长时间没有节拍后回归基准。
- [motion-manager.ts](https://github.com/moeru-ai/airi/blob/dfd9453beaab3af43a40f9bdacebdcb0d51f2723/packages/stage-ui-live2d/src/composables/live2d/motion-manager.ts)：useMotionUpdatePluginBeatSync用半隐式Euler积分跟随角度目标，源码参数stiffness=120、damping=16、mass=1；这不是严格的临界阻尼配置。插拔式pre/post/final阶段管理动作与表情、眨眼、口型。
- [Model.vue](https://github.com/moeru-ai/airi/blob/dfd9453beaab3af43a40f9bdacebdcb0d51f2723/packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue)：beat插件注册在motion manager的pre阶段；不是我们目前的最终渲染前偏移。
- [detector.ts](https://github.com/moeru-ai/airi/blob/dfd9453beaab3af43a40f9bdacebdcb0d51f2723/packages/stage-shared/src/beat-sync/detector.ts)：AudioContext + @nekopaw/tempora AudioWorklet输出beat事件，另有频谱读取；桌面版本获取捕获流后停止视频轨，保留音频输入。

适合复用：动作段调度、弹簧跟随、失拍释放、阶段插件思想。不要整套搬入其桌面应用或把头部摇摆说成全身舞蹈。AIRI现有MIT声明已在本项目保留；后续实际复制新文件应补充文件清单，并另核对Tempora依赖许可。原始弹簧显式积分还需dt上限/子步进，不能认为照搬即可保证所有帧率稳定。

### VTube Studio：控制权和动作素材管理

- [Animations](https://github.com/DenchiSoft/VTubeStudio/wiki/Animations)：支持Editor导出的motion3循环待机与一次性动作，也能基于跟踪录制动画。
- [Interaction between Animations, Tracking, Physics, etc.](https://github.com/DenchiSoft/VTubeStudio/wiki/Interaction-between-Animations,-Tracking,-Physics,-etc.)：明确多个值提供者的优先级，交接时平滑淡变。值得借鉴的是每个参数由谁控制以及交接规则，不是直接照搬其全部优先级。

建议在我们宿主内设置：待机基础层 → 音乐身体动作 → 偶发手势/交互 → 表情/口型各管各的参数 → 物理二级响应 → 最终更新。不同模型可有不同映射，不能把所有参数一律覆盖。

### Open-LLM-VTuber：先核对模型已有动作

[官方Live2D指南](https://docs.llmvtuber.com/en/docs/user-guide/live2d/)提醒游戏/直播模型动作不一定适合陪伴场景，建议检查model3、预览motion、整理Idle与自定义动作组。适合借鉴动作清单与语义映射；本次文档没有提供其已实现音乐舞蹈的证据。

## 推荐实现顺序

### 第一阶段：让当前人物自然地听歌

- 把音乐姿势放在物理之前，基准保存/恢复语义清楚，不修改node_modules源码。当前afterMotionUpdate发生在saveParameters之前，直接挪hook会把音乐偏移保存为下一帧基准，不能只改事件名；应使用受控的物理前扩展或明确的分层更新适配器。
- 用独立的动作控制器维护稳定状态，基于dt更新；主时钟使用单调时间，播放进度负责对齐与seek检测，避免系统时间修正导致跳动。
- 制作三类目标：舒缓侧摆、轻快点拍、短暂手势。身体、头和手臂有不同的起止时间与幅度，眼睛和嘴角保持少量表情变化；头发/裙摆交给现有physics，不再手写同频抖动。
- 4或8拍作为一个动作段，段落末尾才选择下一种动作，避免每拍随机换动作。偶发抬手使用冷却时间。这里是本项目建议，不是上游已保证的功能。
- 减少整人上下平移，保证脚的落地点稳定。前台音乐时目标30fps；由实际dt保证低帧率时速度一致。
- 当前无音频数据，只能称“播放中听歌动作”，不能宣称按歌曲真实节拍。

### 第二阶段：让动作真正听到鼓点

Apple官方的[Core Audio taps示例](https://developer.apple.com/documentation/CoreAudio/capturing-system-audio-with-core-audio-taps)支持从进程或进程组取得输出音频，示例要求macOS14.2+。需要NSAudioCaptureUsageDescription，第一次采集会请求系统音频录制权限。

建议小型原生helper只采网易云相关音频进程，在本机计算音频能量、起音/拍点、节拍置信度，把数值事件发给动作控制器；不保存或上传原始PCM。需要实测网易云辅助进程、耳机/扬声器切换及重启后的进程ID映射。使用不静音的tap配置，不改变用户的收听。

先用能量与起音作反应，再加稳定的拍点估计；有BPM数值不代表已经对齐实际重拍。低置信度、静音、古典散拍或无鼓段落应回退舒缓动作，不强行跳。

AIRI的音频→Worklet→beat事件链可参考，macOS采集优先评估Apple原生进程tap；无需为这一条功能整体迁移到AIRI。用户拒绝权限时，保留播放识别、歌词和自然听歌动作。

### 第三阶段：全身舞蹈

保留Live2D：准备适配同一模型的Dance_Sway / Dance_Bop / Gesture等motion3素材；大幅迈步需要模型本身对应变形和参数。别人模型的动作文件不能当作通用舞步直接套入。

若目标明确包括跨步、转身、抬腿和大动作，再单独评估VRM/3D骨骼与动作重定向。当前以桌面编程陪伴为主，先完善Live2D听歌动作，避免为轻量律动引入整套3D方案。

## 验收方式

固定三段有合法使用权的输入：慢节奏、快节奏、有停顿；录制相同20秒对比旧版与新版。不得只用一张截图声称动作自然。

检查：身体带动头与手、头发有延迟跟随；无整人漂浮和参数越界；30/60fps同速；暂停自然收势；恢复和seek不甩头；交互时音乐动作让位后恢复；丢失拍点能退回舒缓；实际拍点模式下静音不持续重拍。记录CPU和渲染帧耗时，确定“轻量”的实际代价。

优先交付第一阶段的动态对比，再验证真实拍点链路。动作自然与音乐同步是两个验收项，需要分别证明。



后续按“音乐信号与动作模拟分离”的边界形成了新的开源组合调研，见[motion-simulator-open-source-review.md](motion-simulator-open-source-review.md)。该文补充人物能力探测、MAGIC生成器、动画图与局部混合，以及实际参数兼容性检查。
