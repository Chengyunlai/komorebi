# 一条明确的执行链

PCM由现有MusicAnalyzer分析；VRMDanceController只消费features并维护拍时钟；本地播放器选段/采样；姿态和世界踝目标一起混合；createLocalDanceExecutor最终跟随末端目标。Character不再给本地动作叠加旧createContactPlant。

根策略显式in-place-feet-midpoint：移除源水平旅行以适应桌面窗口。该策略的地面参照随源中心变化，因此不能称真实固定地面的无脚滑；源高度与相对舞步保留。原有三段两拍结构仍待替换。

断点：feature.sampleFrame、pose.source.beat、localPose.feet、weighted target、report.desiredError。落脚依踝高度估计，不表示测力/足底接触；投影保留原目标残差。
