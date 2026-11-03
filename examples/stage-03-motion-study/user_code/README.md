# 使用入口

运行 `node examples/stage-03-motion-study/user_code/main.mjs`。输入官方日和 m05 原始动作；输出时长、曲线数、1秒时左臂参数和速度候选点。
需要完整舞蹈数据时追加自己的BVH路径，数据不随源码分发。通过公开 #motion-curves、#bvh 导入使用解析和采样函数。
断点：sampleCurve 的非线性Bezier时间求解，skeletonAt 的父子坐标累积。
