# 实现与数据边界

- `src/motion/garment-clearance.mjs`：从角色主要裙摆骨推导髋局部椭圆柱代理体，检查前臂/腕/指端；两骨手臂避让保留腕部世界朝向，比较可达的表面出口和肘部平面。不修改髋和腿，无法保证衣料三角面与所有手形均无相交。
- `src/motion/motion-pulses.mjs`：从动作的身体活动度估计周期及相位，来源明确为 `kinematic-estimate`；不把估计称为人工音乐拍点。
- `src/motion/freestyle-motion.mjs`：预录素材用对称平滑，不引入因果滤波延迟；未知节奏保持原速；可信音乐加有界速度/相位修正；实际起音触发短促的躯干响应。
- `src/Character.vue`：按唯一音频特征帧累计可靠性，原始观测与动作分开；身体执行后、渲染前做避让。研究方法 `assessGarmentClearance` 可对当前本机模型与库采样并报告代理体残差。
- `electron/music-signal-delivery.mjs`：合并音频批次时保留已检测起音的当时强度；后续特征帧的瞬时通量不再覆盖它。属于宿主传递适配，不修改 vendor 分析器。

`step` 新增 `musicReliable`、`musicPhase`、`onsetStrength`；`rhythm` 报告实际模式、速度和材料周期估计。`sourceBpm` 未知时为 null。低可靠性时 `bpm` 不控制源动作速度；不会冒充精准同步。
