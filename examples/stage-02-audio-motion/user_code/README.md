# 使用

执行 `node examples/stage-02-audio-motion/user_code/main.mjs`。
通过公开导入创建 MusicAnalyzer 和 MusicMotionSimulator，逐块送入 PCM、取 features、得到人物无关的归一化动作。无需 Laya、网络或原生音频授权。
断点：`simulator.step` 的 signal.lastOnsetFrame、bands、返回的 primitive/eventCount。信号负责测量，模拟器负责动作。
