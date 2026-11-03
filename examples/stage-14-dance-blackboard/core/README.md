# 核心源码与语义

- src/motion/motion-record.mjs：BodyProfile + 标准人体绝对局部变换记录；原子验证、apply与compare。局部坐标与世界坐标区分，profile包含hips父级世界矩阵；关节范围/脚底偏移未知。bodyId是调用者标签，不是防跨体型复制的自动重定向。
- src/motion/source-record.mjs：保留源骨架全部局部旋转/位移，包括辅助轨迹根，使用腿长比转换到米。源骨架用唯一id与parent关系；不可直接apply给VRM。
- src/motion/replay-experiment.mjs：固定源采样步长，从起点构造接触/物理历史；倒退和选项变化重建。每个输出关联同一源采样时间。默认无物理、无约束基线可严格重复。
- src/motion-lab/vrm-retarget.mjs：原方向适配器新增根轨迹策略；场景位移转换只使用水平朝向，避免首帧身体倾斜污染世界Y-up。既有balance模式复用同一修正。
- src/motion-lab/ReplayStudy.vue：原生双视图，选层与冻结JSON；不控制桌面宠物、不开音乐、不保存研究姿态。

replay-body.mjs是可移植原创合成体；真实角色验收另外在原生Electron中进行。compare只比较同一目标人体的骨骼姿态，不直接跨源/目标rig比较；方向残差不包含twist或蒙皮质量，final.secondary另外保留弹簧骨数据。

有物理时，同帧请求也从源起点重算，以免外部渲染污染积分状态。长seek会计算整段历史；耗时有显示，目前尚未做检查点优化。
