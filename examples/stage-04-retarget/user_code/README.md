# 使用

运行 `node examples/stage-04-retarget/user_code/main.mjs /本机/参考.bvh /本机/输出.motion3.json`。
原始与生成的研究数据均不随源码分发。CLI使用已核对的日和参数范围，GUI直接从实际Core读取范围。
公开路径：parseBVH → buildRetargetMotion → motion3.json及压缩统计。不需要先理解矩阵或修改内部状态。
断点：measureUpperBody 查看躯干坐标系；retargetPose 查看独立左右臂；buildRetargetMotion 查看限幅与时间戳。
