# 动作示例解剖预览

目标：先复现现成动作，再研究协调、起势和衔接。不改变桌宠的日常轻交互，不在本阶段训练模型或将3D参数强行映射到日和。

独立按需窗口：日和页由 CubismMotion 原生播放器采样官方动作，显示参数曲线、实际值、时间轴、慢放及头/躯干/手臂/表情/物理开关；3D页以BVH骨架播放完整63秒舞蹈，明确标注其不能直接驱动日和。
BVH参考仅保存在本机 userData/research-references，CC BY-NC 4.0，不随app或源码压缩包分发。

Example：examples/stage-03-motion-study/user_code/main.mjs。断点：parseMotion/sampleCurve、parseBVH/skeletonAt、MotionStage 的原生SDK采样与掩码。
验证：全部本地 motion 文件解析与边界、非线性Bezier及分段插值、BVH通道和坐标变换；运行时原生SDK值与曲线采样对比；原生界面检查播放、时间轴、分层、慢放、完整骨架参考。
当前本地工作树未提交。

## 验证及发现

- 36项测试通过、Vite构建通过；8个日和motion均成功解析；非线性Bezier按时间反解，不把播放时间直接当Bezier参数。
- 实际原生SDK播放m05，曲线采样与原生参数差值约1e-6；1秒处仅双臂模式验证：头与躯干归零，左臂-8.231304、右臂-2.167898。证据 ../evidence/motion-study-arms-only.json。
- 图形界面已验证切换m06、0.25倍慢放、1秒定位、分层掩码，以及63.37秒BVH加载及播放。
- 用户指出骨架下方绿色长线。根因是将joint_Root到Hips的辅助场景根连线当作人体骨骼，已隐藏；官方参考渲染脚本同样隐藏第一个辅助根骨。已截图目视确认修复后只剩人体骨架。
- 六通道BVH的局部位置已包含静态骨骼偏移，修复重复叠加OFFSET导致的比例和位移问题；新增带非零OFFSET回归夹具。与Bandai官方使用的Blender位置通道处理约定核对：https://github.com/blender/blender-addons/blob/main/io_anim_bvh/import_bvh.py 。
- 原生SDK权威播放、解析器研究对照；现成日和动作仍是短动作参考而非完整舞蹈。BVH有完整关节协同，但不可原样写入Live2D，需要后续动作重定向。

当前独立研究窗口已打开，默认不改变桌宠音乐动作系统；完整舞蹈数据仅本机存放，不随app和源码包分发。未提交工作树。
