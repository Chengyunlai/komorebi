# 可运行 Example

先运行各阶段的 user_code，再读 core。公开接口或入口变化时同步本索引及实现记录。

| 阶段 | 命令 | 结果 | 记录 |
| --- | --- | --- | --- |
| [Laya 行为意图](stage-01-laya/README.md) | `node examples/stage-01-laya/user_code/main.cjs` | 四条真实中文推理及是否执行 | [stage-01](../docs/implementation/stage-01-laya.md) |
| [音频动作模拟器](stage-02-audio-motion/README.md) | `node examples/stage-02-audio-motion/user_code/main.mjs` | 原创PCM驱动片段组合，静音收势 | [stage-02](../docs/implementation/stage-02-audio-motion.md) |
| [现成动作解剖](stage-03-motion-study/README.md) | `node examples/stage-03-motion-study/user_code/main.mjs` | 日和原始曲线和可选BVH骨架解析 | [stage-03](../docs/implementation/stage-03-motion-study.md) |
| [舞蹈上半身重定向](stage-04-retarget/README.md) | `node examples/stage-04-retarget/user_code/main.mjs /本机/参考.bvh` | 1901帧生成8通道轨迹和限幅统计 | [stage-04](../docs/implementation/stage-04-retarget.md) |
| [VRM全身预览](stage-05-vrm/README.md) | `node examples/stage-05-vrm/user_code/main.cjs /本机/Cute_Model.vrm` | 模型骨骼验证与原生同钟试跳 | [stage-05](../docs/implementation/stage-05-vrm.md) |
| [VRM桌宠与音频动作](stage-06-vrm-desktop/README.md) | `node examples/stage-06-vrm-desktop/user_code/main.mjs` | 合成信号触发肘膝动作及断流收势 | [stage-06](../docs/implementation/stage-06-vrm-desktop.md) |
| [全身动作片段](stage-07-fullbody-clips/README.md) | `node examples/stage-07-fullbody-clips/user_code/main.mjs` | 五类片段、信号调度和支撑脚IK | [stage-07](../docs/implementation/stage-07-fullbody-clips.md) |
| [连续舞句](stage-08-continuous-phrase/README.md) | `node examples/stage-08-continuous-phrase/user_code/main.mjs` | 八拍接缝、承重与不同拍速的持续相位 | [stage-08](../docs/implementation/stage-08-continuous-phrase.md) |
| [舞句变化](stage-09-phrase-variety/README.md) | `node examples/stage-09-phrase-variety/user_code/main.mjs` | 稳定音乐中的六类主题与边界调度 | [stage-09](../docs/implementation/stage-09-phrase-variety.md) |
| [VRM默认待机](stage-10-vrm-idle/README.md) | `node examples/stage-10-vrm-idle/user_code/main.mjs` | 日和m05曲线到VRM的轻动作和循环 | [stage-10](../docs/implementation/stage-10-vrm-idle.md) |
| [音乐表达与舞句组织](stage-11-musical-director/README.md) | `node examples/stage-11-musical-director/user_code/main.mjs` | 音乐起伏、主题呼应和拍速稳定 | [stage-11](../docs/implementation/stage-11-musical-director.md) |
| [真实舞蹈动作库](stage-12-motion-bank/README.md) | `node examples/stage-12-motion-bank/user_code/main.mjs` | 本机BVH构库、选择和停止 | [stage-12](../docs/implementation/stage-12-motion-bank.md) |
| [舞步落脚与拍点](stage-13-beat-steps/README.md) | `node examples/stage-13-beat-steps/user_code/main.mjs` | 三片段锚点与90/120/150 BPM PCM闭环 | [stage-13](../docs/implementation/stage-13-beat-steps.md) |
| [统一运动记录与身体回放](stage-14-dance-blackboard/README.md) | `node examples/stage-14-dance-blackboard/user_code/main.mjs` | 逐层记录、重复回放与根轨迹对照 | [stage-14](../docs/implementation/stage-14-dance-blackboard.md) |
| [校准旋转保真对照](stage-15-rotation-retarget/README.md) | `node examples/stage-15-rotation-retarget/user_code/main.mjs` | 纯twist、腕旋转与模式对照 | [stage-15](../docs/implementation/stage-15-rotation-retarget.md) |
| [连续区间身体评估](stage-16-sequence-assessment/README.md) | `node examples/stage-16-sequence-assessment/user_code/main.mjs` | 三条件聚合、断帧与约束改写 | [stage-16](../docs/implementation/stage-16-sequence-assessment.md) |
| [完整源材料与移动窗口](stage-17-source-material/README.md) | `node examples/stage-17-source-material/user_code/main.mjs` | 完整帧、有向速度、移动过渡与未知接触 | [stage-17](../docs/implementation/stage-17-source-material.md) |
| [源材料到身体执行](stage-18-material-execution/README.md) | `node examples/stage-18-material-execution/user_code/main.mjs` | 移动过渡→FK→目标姿态 | [stage-18](../docs/implementation/stage-18-material-execution.md) |
| [水平轨迹与朝向对齐](stage-19-planar-alignment/README.md) | `node examples/stage-19-planar-alignment/user_code/main.mjs` | 交接起点XZ/yaw与全入段一致变换 | [stage-19](../docs/implementation/stage-19-planar-alignment.md) |
| [后继兼容与接触证据](stage-20-successor-assessment/README.md) | `node examples/stage-20-successor-assessment/user_code/main.mjs` | 有向速度、接触来源及候选拒绝 | [stage-20](../docs/implementation/stage-20-successor-assessment.md) |
| [完整窗口脚部归因](stage-21-foot-window/README.md) | `node examples/stage-21-foot-window/user_code/main.mjs` | 源/目标踝部路径与未知接触分离 | [stage-21](../docs/implementation/stage-21-foot-window-assessment.md) |
| [源踝轨迹跟随](stage-22-ankle-tracking/README.md) | `node examples/stage-22-ankle-tracking/user_code/main.mjs` | 源端点轨迹、可达域与旋转改写对照 | [stage-22](../docs/implementation/stage-22-source-ankle-tracking.md) |
| [日常音乐身体执行](stage-23-daily-execution/README.md) | `node examples/stage-23-daily-execution/user_code/main.mjs` | 实际PCM→时钟→库→末端执行与静音恢复 | [stage-23](../docs/implementation/stage-23-daily-music-execution.md) |
| [混合与限速分层归因](stage-24-limiter-attribution/README.md) | `node examples/stage-24-limiter-attribution/user_code/main.mjs` | 五层几何/改写/速度/目标滞后与原姿态恢复 | [stage-24](../docs/implementation/stage-24-limiter-attribution.md) |
| [根轨迹与原地化归因](stage-25-root-recentring/README.md) | `node examples/stage-25-root-recentring/user_code/main.mjs /absolute/local/dance.bvh` | 原髋部、双踝中点和原地化水平速度分解 | [stage-25](../docs/implementation/stage-25-root-recentring.md) |
| [完整舞句与结构标注](stage-30-dance-structure/README.md) | `node examples/stage-30-dance-structure/user_code/main.mjs /absolute/local/dance.bvh` | 准备/主体/恢复分段、动作重音锚点、朝向转折、接触区间与候选舞句边界（全部运动学估计） | [stage-30](../docs/implementation/stage-30-dance-structure.md) |
| [音乐驱动舞句规划](stage-31-dance-planner/README.md) | `node examples/stage-31-dance-planner/user_code/main.mjs /absolute/local/dance.bvh 120 30` | 同素材×三种音乐的可解释舞句计划（选句/伸缩/对齐误差） | [stage-31](../docs/implementation/stage-31-dance-planner.md) |
| [音乐信号基准](stage-33-music-baseline/README.md) | `node examples/stage-33-music-baseline/user_code/main.mjs` | 合成鼓点已知真值评分：BPM/起音/半倍速/静音恢复/端到端规划 | [stage-33](../docs/implementation/stage-33-music-baseline.md) |

## 日常播放连续性回归

[连续窗口与手部碎抖](motion-continuity/README.md)：`node examples/motion-continuity/user_code/main.mjs`。纯合成姿态，不需要本机角色或动作素材；验证身体参与、能量抖动隔离和停止淡出。实现见 [播放连续性修复](../docs/implementation/motion-playback-continuity.md)。

## 手裙避让与节奏响应

[几何约束、原速与起音回归](garment-rhythm/README.md)：`node examples/garment-rhythm/user_code/main.mjs`。不需要角色素材，验证代理体投影、未知节奏不降速和起音响应；配合手臂骨架及已知拍点测试。

该例同时验证宿主合并批次时保留起音事件强度；见[节奏感退步修复](../docs/implementation/rhythm-onset-delivery.md)。
