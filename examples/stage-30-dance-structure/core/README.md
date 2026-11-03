# 核心算法

结构标注算法位于 [src/motion/dance-structure.mjs](../../../src/motion/dance-structure.mjs)，本阶段没有复制第二份实现：

- `annotateDanceStructure(material, {fps, phases})`：输入 `source-motion-material/v1`，输出 `dance-structure/v1`。
- 活动度包络：关节角速度模长均值 + 根水平线速度加权，滑动平均。
- 分段：迟滞阈值（峰值 42% / 22%）+ 最小持续帧，产出 preparation / main / recovery；可由 `phases` 显式覆盖。
- 重音：接触估计的落脚事件 + 活动度局部峰值（最小间隔约 0.1s），标注 `kinematic-estimate`。
- 朝向：髋宽轴（UpperLeg_L→UpperLeg_R）水平角，展开后检测 ≥1.2 rad/s 的转折。
- 接触：复用 [contact-analysis.mjs](../../../src/motion/contact-analysis.mjs) 的共享水平面运动学估计，转成区间。

Reviewer 注意：分段/重音/接触均为运动学估计，不构成编舞、歌曲节拍或足底受力真值。
