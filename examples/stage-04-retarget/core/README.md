# 核心

src/motion-lab/retarget.mjs：通过几何姿态与相对旋转提取头、躯干、抬臂特征；首帧校准，身体转向用周期投影避免背向跳变；90ms平滑、每秒4归一化单位限速，再转换为真实Core范围。
retarget-worker.mjs在独立线程生成整段轨迹，避免阻塞预览界面。原生MotionStage负责权威播放与采样差值核对。
已有8个motion动作解析、BVH坐标变换与辅助根处理沿用stage-03。没有将BVH角度原封不动写入Live2D，也没有为不可动关节制造参数。
