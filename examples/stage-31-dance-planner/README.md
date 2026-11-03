# 音乐驱动舞句规划（DANCE-03）

用 DANCE-02 的结构标注 + 一条音乐描述（BPM 与能量曲线），离线生成可解释的舞句计划：每个音乐时窗选用哪个源舞句、时间伸缩多少、重音对齐误差、为什么这样选。

从项目根目录运行（需要本机 BVH，不随源码分发）：

```sh
node examples/stage-31-dance-planner/user_code/main.mjs '/absolute/local/dance.bvh' 120 30
```

参数：BVH 路径、BPM（默认 120）、音乐时长秒（默认 30）。输出 `dance-plan/v1` JSON。算法在 [src/motion/dance-planner.mjs](../../src/motion/dance-planner.mjs)。

限制：音乐段标签来自能量曲线启发式，不是歌曲段落识别；舞句选择是长度/新颖度/能量/支撑脚连续性的启发式平衡，不是编舞最优；重音对齐假设给定 BPM，不处理半/倍速；源句仍是运动学候选分组，不是真实编舞句。
