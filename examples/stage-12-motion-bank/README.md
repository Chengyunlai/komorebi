# 本地真实舞蹈动作库

运行：`node examples/stage-12-motion-bank/user_code/main.mjs [本机BVH路径]`。
默认读取本机研究参考，输出950个采样帧、12个片段、120秒模拟中的片段访问和停止权重。
先读 user_code/main.mjs，再读 core/README.md。Example以真实BVH骨段方向构建代理姿态，验证调度及过渡；桌宠使用实际VRM重定向姿态，二者不得混称为完整实机效果验收。
断点：createMotionBank查看clips；MotionBankPlayer.choose查看候选代价；step查看previous、transition和weight。
[实现记录](../../docs/implementation/stage-12-motion-bank.md)。本阶段未提交。数据本机研究使用，不随源码分发。
