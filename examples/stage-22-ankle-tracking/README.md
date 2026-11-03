# 源踝轨迹跟随

`node examples/stage-22-ankle-tracking/user_code/main.mjs`：原创动作与腿段比例不同的合成目标，比较旋转基线和源踝跟随。末端目标不可达时输出原目标残差，不以投影点的零误差冒充成功。

真实角色入口：材料 · 连续过渡 → 检索并预览48秒候选 → 踝轨迹跟随关闭/开启 → 评估源脚与目标脚。开启条件从源首帧与目标标定首帧建锚，保留源滑步、抬脚，不做接触锁定。

[实施记录](../../docs/implementation/stage-22-source-ankle-tracking.md)
