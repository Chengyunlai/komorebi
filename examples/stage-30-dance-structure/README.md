# 完整舞句与结构标注（DANCE-02）

从完整源动作材料生成可追溯的结构标注：准备/主体/恢复分段、动作重音锚点、朝向转折、脚部接触区间。**全部为运动学估计**（source: kinematic-estimate），不是歌曲节拍、不是人工标签、不是足底受力。

从项目根目录运行（需要本机 BVH，不随源码分发）：

```sh
node examples/stage-30-dance-structure/user_code/main.mjs '/absolute/local/dance.bvh'
```

输出为 `dance-structure/v1` JSON：`segments`、`accents`、`orientation`、`contact`、`phraseHints` 与 `limitations`。算法在 [src/motion/dance-structure.mjs](../../src/motion/dance-structure.mjs)，接触估计复用 [contact-analysis.mjs](../../src/motion/contact-analysis.mjs)。

限制：分段是探索性运动学分组，不是编舞真值；重音是动作峰值与估计落脚，不是歌曲拍点/强拍；接触是水平面运动学估计；朝向来自髋宽轴，无传感器标定。完整材料不被修改——切片与音乐同步留到 DANCE-02/03 后续。
