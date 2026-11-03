# 材料到身体执行

运行 `node examples/stage-18-material-execution/user_code/main.mjs`：原创合成身体和源动作经过材料、移动过渡、FK与旋转重定向输出目标姿态差异。不需要模型文件。

真实角色入口：动作解剖 → 材料 · 连续过渡。默认出段9秒、入段12.6秒，1.5–2秒为双侧运动过渡；该组合仅用于观察，不表示舞蹈编排已通过。当前保持源轨迹、不自动对齐，接触未知、无锁脚及物理，未接入音乐信号。

[实施记录](../../docs/implementation/stage-18-material-execution.md)
