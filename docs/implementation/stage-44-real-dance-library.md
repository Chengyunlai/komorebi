# Stage44 真人舞蹈动作库（23 支 BVH，信号驱动）

## 本次做什么

用户要求"真人质感"。定位：程序化律动"鬼畜"（肢体协调差），生成模型（Bailando）动作词汇受 AIST++ 数据集限制。改走**真实动捕舞蹈数据**路线：

1. **数据源**：GitHub `tulay-hub/dance-dataset`（MIT 许可），`raw_bvh/original_bvh/` 含 23 支真人舞蹈 BVH（Attention、GENTO、apt、BIGBANG、MANIAC、DADDY 等流行舞，共约 17 分钟）。
2. **关节映射**：数据集为 Mixamo 命名（LeftUpLeg/LeftArm/Spine1...），编译管线期望 BT 命名（UpperLeg_L/UpperArm_L/Chest...）——写 `renameBvh`（JOINT/ROOT 名替换，MOTION 段不动）。
3. **批量编译**：Electron + `prepareLocalDance` → 每支舞编译为 VRM 骨骼帧（15fps），输出到 `userData/dance-library/`（23 clips、15364 帧、33MB）。
4. **接入桌宠**：主进程 `danceLibrary` IPC 返回合并帧；Character 用 `createFreestyleMotionPlayer`（motion matching）播放，信号（能量/重音/速度）驱动选段。

## 结果、验证与结论

- 编译成功 23/28（5 个失败为 g1_moves 等非标准格式）；总时长 **1024 秒**、**15364 帧**。
- 直接渲染编译结果（Attention 600 帧）：跨步/抬腿/转体/蹲等真人动作丰富自然 ✓。
- 桌宠实测（dataset：danceLibrary=15364、danceSourceFrame 在库内、weight=1.0）：连续 10 帧动作各异（手臂摆动/转身/倾斜/腿部动作），真人舞蹈质感 ✓。
- 222 测试通过。

**结论**：真人质感路线成立——动作来自真实舞者的编舞，信号驱动选段/调制；素材量（17 分钟、23 支舞）远大于此前（63 秒）。motion matching 仍是"从素材中选段"（非逐帧生成），但动作质量是真人动捕。

## 资源和调整

- 数据：`/tmp/dance-dataset`（克隆，不入库）；库：`~/Library/Application Support/Komorebi/dance-library/`（33MB，manifest + 23 clip JSON）。
- 修改：`electron/main.cjs`（danceLibrary IPC）、`electron/preload.cjs`、`Character.vue`（库加载 + freestyle player）。

## 进一步评估与下一步

- 段边界/过渡观感，密度（segmentSeconds 1.7s）。
- 可继续扩充素材（其他公开舞蹈 BVH），或加入"风格选择"。
- 若需"逐帧生成"则回到生成模型路线（Bailando/EDGE），但与真人动捕是不同取舍。
