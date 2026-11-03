# 核心定位

- electron/vrm-model.cjs：完整GLB、骨骼和外部资源验证。
- src/motion-lab/vrm-retarget.mjs：来源髋部坐标系校准 → 世界关节方向 → 目标标准骨骼局部四元数。
- src/motion-lab/VRMStage.vue：本机VRM载入、MToon渲染、物理与销毁。
- src/motion-lab/MotionLab.vue：同一时间轴的骨架/角色对照。

音乐信号与编排策略不在本模块。研究参考和角色不打包。
