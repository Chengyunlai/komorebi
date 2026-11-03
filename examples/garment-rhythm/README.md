# 裙摆避让与低延迟节奏响应

```sh
node examples/garment-rhythm/user_code/main.mjs
```

先运行 `user_code`，再读 `core/README.md`。例子只含合成几何和姿态，断言手部点退出裙摆代理体、低置信度的 100 BPM 不再将动作降速、起音会触发短促身体响应。

同时验证批次末尾通量为零时，仍能保留已检测起音的原始强度。起音传递与真实拍点识别分别验收，见[修复记录](../../docs/implementation/rhythm-onset-delivery.md)。

角色实机避让仍需有裙摆骨的 VRM；没有裙摆骨时不会凭空假设服装尺寸。此例不证明三角网格/布料碰撞，也不证明真实歌曲拍点准确。见[实现记录](../../docs/implementation/garment-clearance-rhythm.md)。
