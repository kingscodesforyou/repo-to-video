---
name: repo-to-video
description: >-
  用于将 GitHub 项目（包括 Web/CLI/AI 等可运行项目，以及 Agent Skill、Prompt 提示词、规则库等 Skill 类项目）
  制作成“特级教师给小学生讲课”级别的 3D 动画深度讲解与教程视频。融合 video-shotcraft 3D 空间运镜体系，
  把每个核心功能拆开单独讲解，按功能本质动态匹配 3D 爆炸图、3D 漏斗萃取、3D 时间走廊、四路侦探雷达、
  3D 卷帘对比、3D 空间终端穿梭与 3D 环形展台，结合 Index-TTS 配音（默认 yali.wav）与字词高亮字幕直接渲染完整 MP4。
---

# GitHub Repo to 3D Pedagogical Video Generator (`repo-to-video` v3)

本 Skill 将任意 GitHub 开源项目转化为**像特级教师给小学生讲课一样通俗易懂、且每个核心功能都配有专属 3D 演示动画**的高留存教程视频（融合 `video-shotcraft` 3D 运镜语法）。

---

## 一、 核心教学理念与 Shotcraft 3D 运镜法则

### 1. 教学法则：像特级教师给小学生讲课 + 强数据事实核查
- **严禁堆砌枯燥卡片与箭头**：绝不允许每个功能都只摆几张平面卡片加箭头，也不允许仅仅把平面卡片做个简单 3D 倾斜敷衍了事。
- **把文案所讲内容做成对应的 3D 实体道具与相机运镜**：
  - 例如讲“课桌堆书 vs 随身错题本”：必须真的在 3D 空间里画出一张**实木课桌**，上面横七竖八摆放写着各种记忆的 **3D 立体书本**（《花生严重过敏》被压在最底下）；随后切入 **`timeline-travel`（时间轴横移——镜头沿水平刻度轴加速掠过文本卡片，每过一格重要卡片弹立短停，末刻度急停推近）** + **`deck-deal-flyin`（重要卡片硬加速甩进错题本网格，相机追着发牌升起后仰、落在整块满板的跑道式俯瞰上定格）**！
- **强制数据与事实核查（Fact Check Gate）**：
  - `analyze_repo.py` 会直连 GitHub API 实时抓取最新 `stars`（如 `68,542` -> `68,500+ Star`）与 `README.md` 权威指标；
  - `build_video.py` 内置 `audit_storyboard_facts` 审查门禁，严禁引用网上旧博文的过时 Star 数！

### 2. 视觉、字幕与配音规范
- **字幕平稳不闪烁 (`Subtitles.tsx`)**：严禁逐字跳动发光框、严禁切换字重/缩放导致排版抖动、严禁在 Remotion 中使用 CSS `transition`。采用整句平稳高对比呈现。
- **鲜艳活力 3D 演播室背景 (`Background.tsx` & `theme.ts`)**：采用高饱和度宝蓝-紫罗兰-青色极光渐变与暖阳金/珊瑚粉动态流光球，衬托 3D 立体道具。
- **语速默认调低 1/10 (`--speed 0.9`)**：`tts_generator.py` 与 `build_video.py` 默认使用 `ffmpeg atempo=0.9` 在保持原音调（`yali.wav`）不变的前提下放慢 10% 语速，娓娓道来、字字清晰。
- **启动子 Agent 预设每段分镜的 3D 动画 (`workspace/shot_choreography.json`)**：在生成或升级分镜时，启动子 Agent 核查所有数字并结合文案预设每一幕的 3D 实体道具与多阶段相机运镜。

### 2. 运镜法则：按功能本质选配专属 3D 仿真镜头（Inspired by `video-shotcraft`）
详见 [`references/scene-schema.md`](./references/scene-schema.md)：

| 功能/机制本质 | 专属 3D 镜头 `type` | 3D 视觉与动画表现 |
| --- | --- | --- |
| **痛点引入 / 概念误区** | `analogy_3d` | **3D 具象生活剧场**：左舞台杂乱书堆摇晃告警 vs 右舞台 3D 悬浮卡片盒精准抽卡 |
| **过滤 / 提纯 / 转换管线** | `funnel_3d` | **3D 漏斗萃取实验室**：贝塞尔流光飞入 3D 旋转陀螺仪，废话坠入回收桶，产出纯净胶囊 |
| **时间轴演进 / 防篡改状态** | `timeline_3d` | **3D 时空走廊与演进桥**：3D 透视跑道展示历史页与最新页，彩虹弧线连接状态变迁 |
| **多层系统架构 / 存储分层** | `exploded_3d` | **3/4 等轴测 3D 爆炸拆解图**：三层芯片沿 Z 轴弹簧炸开、激光立柱贯穿、悬停拆解后合体 |
| **多路信号打分 / 混合检索** | `radar_sim` | **四路侦探合议庭**：4 张 3D 侦探卡翻转入场，实时充能分数条，底部汇聚最佳答案 |
| **使用前 vs 使用后实测对比** | `slider_scrub` | **3D 激光卷帘推拉对比**：发光卷帘横扫屏幕，同屏对比失忆翻车现场 vs 满分省钱秒回 |
| **代码三步上手 / CLI 实操** | `terminal_3d` | **3D 空间终端穿梭**：透视网格地板上悬浮 3 个倾角终端，打字机敲代码 + 老师大白话便利贴 |
| **生态插件 / 技能百宝箱** | `carousel_3d` | **3D 环形旋转陈列馆**：多张技能卡组成 3D 旋转木马环，依次转到正前方聚光灯下展示 |

> **铁律**：全片任意相邻两个镜头的 `type` 绝不允许相同！

---

## 二、 核心执行步骤

### 步骤 1：扫描并剖析仓库 (`analyze_repo.py`)
```bash
python scripts/analyze_repo.py --path <目标项目路径> --output workspace/repo_profile.json
```

### 步骤 2：启动“特级教师 + 3D 运镜导演”子 Agent（关键！）
调用 `define_subagent` + `invoke_subagent` 启动文案策划子 Agent（提示词见 [`agents/scriptwriter.md`](./agents/scriptwriter.md)，分镜 Schema 见 [`references/scene-schema.md`](./references/scene-schema.md)），生成 `workspace/storyboard.json` 与 `workspace/research.md`。

### 步骤 3：局域网 Index-TTS 配音与参数组装 (`build_video.py`)
```bash
# 全量构建（默认 yali.wav，内置 Edge-TTS 自动兜底）
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav
```

### 步骤 4：先导片审核与完整 MP4 渲染
```bash
# 快速渲染 30 秒先导样片
npm run render:pilot

# 全量并发渲染完整高清 MP4 视频与封面
npx remotion render src/index.ts TutorialVideo out/tutorial.mp4 --props=workspace/build_props.json --concurrency=4
npm run still
```
