# 归因接口

`assessRootRecentring(samples,{sourceUnitMetres})` 位于 `src/motion/root-recentring-assessment.mjs`。每个样本包含递增time、hips和feet.left/right三维位置。一次传入一个连续窗口，禁止拼接不连续片段。

断点依次查看 points.center、velocities.hips/center/relative、squaredSpeedDecomposition。只计算XZ，保留重力轴Y不参与原地化分析。速度按相邻时间差，加速度按相邻速度区间中点时间差；同时支持不等时间间隔。输出max/P95/mean和峰值时间，不输出原姿态。

核心不变量：vRelative=vHips−vCenter。共同世界平移应抵消；固定身体单独踢一只脚时，双脚中心会以半个踢脚速度移动，给原地化髋部引入反向速度。这个合成例子不证明实际动作自然性。有限差分加速度受源噪声和采样影响，不是测力数据。
