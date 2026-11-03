# 核心实现

生产代码不复制：electron/behavior.cjs 管理本地进程、协议校验及意图状态；electron/behavior-worker.py 调用 Laya 多语言 checkpoint；src/behavior-pose.mjs 将意图应用为有界幅度。Character.vue 以 250ms 包络收势，音乐分析器不接触意图。
断点：worker 的 agent.predict，BehaviorDirector 的 validateDecision，以及 Character 的 applyBehaviorPose。
当前工作树未提交。正式舞蹈片段组合仍待后续动作模拟器实现，本版验证决策接入与可见幅度差异。
