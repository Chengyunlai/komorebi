# 根轨迹与原地化归因

从项目根目录运行：

```sh
node examples/stage-25-root-recentring/user_code/main.mjs '/absolute/local/dance.bvh'
```

先跑 user_code，再读 [core](core/README.md)。资源由用户本地提供；不随源码分发。输出只有连续源窗口聚合，不含原始骨骼轨迹。

输入单位明确假设为厘米；其他来源必须修改调用时的单位。原始采样网格和15Hz编译网格分别报告。未经过实际模型、IK、音频时钟或片段衔接，不能当作实际桌宠速度或舞蹈质量评分。
