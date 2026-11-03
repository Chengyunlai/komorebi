# 核心

- [synthetic-music.mjs](synthetic-music.mjs)：确定性鼓点生成器（four-on-the-floor、半拍陷阱、段落弧线、静音缺口、纯静音）。全部用固定随机种子，可重复。
- [score.mjs](score.mjs)：按宿主 worker 的方式分块 push PCM，收集 `features/onset/beat/state`，与真值比较：起音匹配（±50ms）、BPM 中位数与误差、半/倍速比例、状态流转时间。

评分只描述分析器输出与已知真值的偏差，不是音乐质量判断；合成输入的结论不能外推真实歌曲。
