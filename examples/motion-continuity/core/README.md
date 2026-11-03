# 实现入口

- `src/motion/freestyle-motion.mjs`：连续窗口活动度与身体参与度 → 姿态/有向速度代价 → 源段内插值 → 双侧移动交叠 → 全身/踝目标一致过滤。
- `electron/dance-library.cjs`：加载素材时保留每支舞实际帧范围，不把两支舞拼成连续时间。
- `src/Character.vue`：可见时逐 rAF 渲染；动作库/实验流式来源互斥，身体执行负责末端姿态。

源码接口为 `createFreestyleMotionPlayer(frames, {fps, clips, segmentSeconds, crossfadeSeconds, smoothingSeconds})`；`clips` 的 `start/end` 均为包含端点的整数索引。缺省时所有帧视为一支舞。音乐输入控制选段与平滑变速，不缩放源关节角。素材只含手部动作时不能凭控制器创造新的舞步。
