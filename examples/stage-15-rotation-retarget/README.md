# 校准旋转与方向映射对照

运行：`node examples/stage-15-rotation-retarget/user_code/main.mjs`。原创纯扭转骨架验证：端点方向不变，方向模式漏掉上臂90°轴向旋转；校准旋转模式保留该变化和手腕旋转。可追加本机BVH路径，输出12.533/23.5/41.8秒的汇总对照。

公开调用：createReplayExperiment(vrm,bvh).evaluate({time,retargetMode:'direction'|'rotation',...})。先读user_code，再读core/README.md及[实现记录](../../docs/implementation/stage-15-rotation-retarget.md)。未提交。

原生入口：右键人物 → 动作解剖 → 分层回放 → 映射方式。默认方向基线，关闭约束/物理、混合权重1，才能隔离旋转映射差异。预置上臂/手腕/足趾时间点。

断点：createVRMRotationRetarget的baseline/initialInverse/conversion；targets的世界旋转公式；apply父到子转换；measure的完整旋转残差。纯swing导致投影退化时twist为null，不把不确定值当0。

只证明源旋转变化按声明的校准参考传递，不证明舞蹈自然或解剖扭转绝对零点正确。没有旋转通道不启用新模式；映射覆盖由profile列出。日常桌宠仍使用原方向映射。
