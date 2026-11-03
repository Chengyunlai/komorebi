# 核心算法

规划算法位于 [src/motion/dance-planner.mjs](../../../src/motion/dance-planner.mjs)，本阶段没有复制第二份实现：

- `planDancePhrases({structure, music, options})`：输入 `dance-structure/v1` + 音乐描述（bpm、时长、能量采样点），输出 `dance-plan/v1`。
- 音乐段：按能量曲线用 fast/slow 趋势与电平阈值判 mode（quiet/flow/drive/rising/settling），合并成段；这是启发式，不是歌曲结构识别。
- 句库：来自结构的候选舞句边界（无边界时按重音分组），带句长、重音率、起止支撑脚。
- 时间窗：每段均匀切分（避免段尾拉伸）；句长接近窗口的句优先，伸缩比默认限制在 0.8–1.25。
- 选择：长度匹配 + 新颖度（drive/rising 更爱新句）+ 能量匹配 + 支撑脚连续性；重复次数有硬上限（语料不足时放宽并标记 `repeatLimitRelaxed`）。
- 对齐：把源句重音映射到音乐时间，统计到最近拍点的中位误差；输出每句的 reason 与来源标注。

Reviewer 注意：这是确定性离线启发式基线，无学习、无音频识别；舞句选择不是编舞最优解。
