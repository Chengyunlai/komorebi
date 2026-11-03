# 统一运动记录与分层回放

先运行 `node examples/stage-14-dance-blackboard/user_code/main.mjs`。无需角色文件；原创合成骨架包含非恒等rest旋转。可追加本机BVH路径，验证相同公开接口处理研究数据。

最短组装路径：createReplayFixture → createReplayExperiment(vrm,bvh) → evaluate({time,rootMode,blendWeight,constraints,physics,music})。运行输出身体能力、源/目标坐标、重复定位一致性、各层变化及音乐观测的独立采样时钟。默认物理关闭、无约束、混合权重1。

真实人物：右键桌宠 → 动作解剖 · 实验 → 分层回放。源骨架与目标VRM同钟，选择显示层、根位移、混合权重与足约束，再查看当前帧JSON。源轨迹模式只让镜头跟随，根记录仍保持真实位移。混合实验是与rest混合，不是日常两拍拼接器。

[核心代码说明](core/README.md) · [实现记录](../../docs/implementation/stage-14-dance-blackboard.md)。当前未提交。

断点：capturePoseRecord查看normalized-local-absolute；evaluate查看sourceTime/clock关系；advance查看各阶段；comparePoseRecords查看骨骼改写量；rootConversion查看水平移动是否错误进入Y轴。

本阶段证明记录/回放和身体归因能力；不宣称舞蹈观感已修复。音乐作为已记录观测附入，两个时钟尚未映射，未新增编舞。真实研究动作及角色只保留本机，未打包或上传。
