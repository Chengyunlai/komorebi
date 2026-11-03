# 使用入口

项目根目录执行 `sh scripts/setup-laya.sh`，再运行 `node examples/stage-01-laya/user_code/main.cjs`。
通过 BehaviorDirector.decide(text) 获得模型决策；用 finally stop 释放模型进程。可追加一条命令作为参数。
关键断点 BehaviorDirector.decide：观察 result.accepted，低置信度及 other 不应改变 state。
