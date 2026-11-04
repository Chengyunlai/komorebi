# 文档图片来源

| 文件 | 来源与用途 | 许可 |
| --- | --- | --- |
| `cover.png` | 本项目 AI 生成的品牌插画，不是应用截图或已提供的角色资产 | 项目品牌配图；不代表获得其他角色或音乐权利 |
| `architecture.svg` | 本项目绘制的模块关系图 | 项目源码 MIT |
| `shino-front.png` / `shino-side.png` | 使用本仓库内置 Sendagaya Shino VRM，分别作正面和约 37° 斜侧面的静态参考渲染；供首页和角色图鉴展示外观 | 角色原作者 pixiv Inc. / VRoid Project，CC0 1.0 |

## 千驮谷筱参考图

图片分辨率均为 600 × 800，采用 PNG，本地随文档保存，不依赖第三方图床。它们是单独渲染的模型外观参考，**不是应用截图、实际待机帧或舞蹈效果承诺**；无音乐、歌词、用户界面、个人信息或其他角色素材。

渲染直接读取[随仓库提供的 VRM](../../assets/avatars/sendagaya-shino/)，模型 SHA-256 为 `1e177c1a7b14f783a9c48395831db8616260d3bddd4154cb2784b779adca49b5`。使用项目已安装的 Three.js / three-vrm 与 Electron 离屏渲染：600 × 800、像素比 1、背景 `#f3f5f0`、正交镜头，灯光与日常角色接近；上臂调为自然下垂，仅作用于渲染场景，不修改 VRM 文件。参考图无 AI 重绘或后期角色修改。

生成与核对日期：2026-11-04。作者的[角色及 CC0 说明](https://vroid.pixiv.help/hc/en-us/articles/360013482714-Sendagaya-Shino)、[官方模型页](https://hub.vroid.com/en/characters/5860098757548846785/models/6567311261748429976)、[本地完整许可](../../assets/avatars/sendagaya-shino/LICENSE.txt)与[来源记录](../../assets/avatars/sendagaya-shino/provenance.json)分别保留。

可选角色只链接作者的图片、模型和许可页面，没有将禁止再分发角色的文件或商店宣传图复制进仓库。图片引用不代表 pixiv 或其他作者为本项目背书。
