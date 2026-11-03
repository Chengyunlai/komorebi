# 连续源区间的分层段落评估

运行：`node examples/stage-16-sequence-assessment/user_code/main.mjs`。
可追加 `[本机BVH路径] [开始秒] [结束秒] [height|source|balance]`。默认原创合成骨架；本机研究源默认9–18秒，非音乐乐句标注。报告不包含原始姿态或模型。

公开路径：createReplayExperiment → assessReplaySegment → 三条件createSequenceAssessment.push/finish。最少使用者代码见user_code/main.mjs；[核心说明](core/README.md)与[实现记录](../../docs/implementation/stage-16-sequence-assessment.md)解释字段与证据。

原生入口：右键人物 → 动作解剖 → 分层回放 → 完整段落对照。选择源区间和根策略后运行；可以取消，结束恢复当前回放状态。三条件固定rest混合1/physics关闭，表格是最终层残差，详情另存约束前残差；峰值按钮按对应条件定位。

断点：assessReplaySegment固定源采样索引；createSequenceAssessment.push的dt/断流窗口；约束前后残差；skeletonAt帧时间回读。角色方向、旋转残差、角速率和IK改写是独立观测，不产生综合自然度分数。

实际角色视频仅保存在本机work/stage16-sequence-assessment（主工作区），不随源码或app分发。无音频，因此不能验收音乐同步；source根模式镜头跟随不能被解读为消除了脚滑。跨真实体型及舞蹈表达仍需后续。未提交。
