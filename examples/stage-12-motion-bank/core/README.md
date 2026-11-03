正式实现：src/motion/motion-bank.mjs维护片段特征、选择和混合；src/motion/local-dance.mjs维护本机BVH到具体VRM的姿态预采样；Character.vue只组装并处理音乐状态。
调度输入为已解析的active、bpm、energy，不读取PCM，不改变独立音乐分析项目。
固定4.8秒片段尚未按真实舞蹈落脚边界分割；接触阈值为启发式。下一阶段应标定源节拍与接触、改善root轨迹及约束过渡。
