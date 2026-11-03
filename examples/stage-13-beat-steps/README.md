# 动作落脚与音乐时钟

运行：`node examples/stage-13-beat-steps/user_code/main.mjs [本机BVH路径]`。
输入为本机研究BVH；无数据时明确失败，不下载动作、不打包派生姿态。
输出三段动作的落脚锚点、接触估计阈值，以及90/120/150 BPM各30秒的调度、时钟误差与停止统计。

先读user_code/main.mjs：真实源骨段代理姿态 → createBeatMotionBank → BeatStepPlayer.step；随后core/stable-pcm.mjs使用真正MusicAnalyzer和VRMDanceController验证原创PCM。代理姿态并非具体VRM；实际角色验证另见原生证据。
断点：createBeatMotionBank的candidates/selected；sourceFrameAtBeat；BeatStepPlayer.step的clipStartBeat/plannedNext；verifyStablePCM中的音乐时钟与已知鼓点误差。
[实现记录](../../docs/implementation/stage-13-beat-steps.md)。当前未提交。

研究窗口：右键人物 → 动作解剖 · 实验 → 音乐 · 踩拍验证。页面只读当前桌宠状态，不自动发声。展示源帧采样误差、脚踝高度和最近可见落脚估计，不把时间映射误差当作视觉或听觉同步结论。
