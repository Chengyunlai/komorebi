# 限速分层归因

运行 `node examples/stage-24-limiter-attribution/user_code/main.mjs`。原创全身平移样例让根和踝原本一致，故意超过根速度限制；比较四层误差，以及统一下身过滤带来的目标滞后。低IK误差不代表更准确踩拍。

真实角色入口：动作研究 → 音乐执行 · 集成 → 分层评估动作限速。停止实时验证后，对同一原创PCM以固定步长做27秒反事实回放，结束恢复原角色姿态；仅输出聚合，不导出姿态。

[实现记录](../../docs/implementation/stage-24-limiter-attribution.md)
