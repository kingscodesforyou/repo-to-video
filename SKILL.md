---
name: repo-to-video
description: >-
  将 GitHub 项目（包括 Web/CLI/AI 等可运行项目，以及 Agent Skill、Prompt 提示词、规则库等项目）
  转化为「Premium Editorial Tech Explainer」级别的深度视觉演示视频（v4）。
  采用「文案编剧 ➔ 视觉导演 ➔ 动效设计师 ➔ 视觉 QA」四角色导演制，
  拒绝 PPT 卡片堆砌与套模板填字，以物理实体的行为动作表达技术原理，结合短语级音画时间锚点、
  首镜样板审核（First Shot Approval）与全片 Contact Sheet 视觉验收直接渲染高清 MP4。
---

# GitHub Repo Visual Explainer Director (`repo-to-video` v4)

本 Skill 的核心定位不再是「给文字配动画的 PPT 工具」，而是**根据讲解内容导演一场真正的技术视觉演示（Visual Direction）**。

---

## 一、 v4 六大核心原则（Core Principles）

### 1. 内容决定视觉（Content Drives Visuals）
- **先理解文案，再设计画面，严禁先选模板再填文字**。
- 文案编剧只负责把技术原理讲透、提取真实代码与数据；视觉导演根据每一句文案思考「观众应该看到什么画面才能秒懂」，再设计空间、物体与动作。

### 2. 动作表达原理（Motion Expresses Mechanism）
- **动画必须由物体的物理行为来表达文案，而不是让物体充当承载文字的展板**。
- 抽象技术概念应转化为实体装置的行为、形态变化与空间关系（如：信息粒子沿空间曲线涌入透明过滤舱 ➔ 阀门将噪音分流坠入废料仓 ➔ 有效信号凝聚成高纯度晶体 ➔ 摄像机推进特写）。

### 3. 真实素材优先（Authentic Assets First）
- 能展示项目**真实界面、真实代码运行过程、真实终端交互、真实架构文件**的镜头，绝不用虚构的概念卡片代替。
- 代码与命令行演示应聚焦核心逻辑行（配合行级高亮与其余行暗化让位），而非大段静态文本堆砌。

### 4. 统一艺术指导（Unified Art Direction：Premium Editorial Tech Explainer）
- **摒弃廉价塑料感与高饱和极光背景**：严禁默认全片使用高饱和宝蓝/紫罗兰极光渐变、彩虹弧线、无意义的动态流光球或满屏粒子。
- **采用高级科技编辑设计 + 产品演示 + 电影感 2.5D/3D 动效**，全片统一色彩、字体、材质、灯光与空间语言，支持四种核心视觉模态：
  1. **浅色编辑风格 (`light_editorial`)**：暖白纸感背景（`#F6F5F0` / `#EFECE6`），干净、理性、充足留白，适合概念引入、数学/逻辑推导与原理拆解。
  2. **深色电影风格 (`dark_cinematic`)**：深邃碳黑/曜石背景（`#0B0D12` / `#11141C`），柔和工作室主光与轮廓光，突出发光主体与空间纵深，适合技术架构与核心机制。
  3. **真实产品演示风格 (`product_demo`)**：克制的演播室暗场或浅场托底，聚焦真实网页、产品 UI、代码编辑器与终端实操过程。
  4. **3D 机制演示风格 (`mechanism_3d`)**：具有明确物理质感（半透明磨砂玻璃 `translucent_glass`、拉丝阳极铝 `brushed_aluminum`、哑光陶瓷 `matte_ceramic`）的实体道具、结构拆解与物理运动。
- **单主色克制原则**：每个镜头只允许使用**一个主强调色（`accent_color`）**引导视线焦点，其余元素使用中性灰阶辅助。

### 5. 运动克制而精准（Restrained & Precise Motion · 反 PPT 镜头系统）
- **废除「相邻镜头 `type` 绝不允许相同」的机械限制**：
  - 优先保证**视觉叙事的连续性（Narrative Continuity）**。当一个技术原理包含连续的多个阶段时，摄像机应保持在同一个三维场景（同一 `continuity_group`）中跟随主体完成连续动作，通过改变**景别（`wide` ➔ `medium` ➔ `close_up` ➔ `macro`）**、焦点和物体状态推进叙事，而非强行切换模板打断连贯性。
- **一镜一主动作（One Primary Action per Beat）**：每个分镜节拍（`beat`）只突出一个核心视觉动作。
- **镜头让位与元素预算（Camera Yielding & Element Budget）**：
  - 单画面同屏主要视觉元素不超过 `4` 个（`element_budget <= 4`）；
  - 当核心动作发生时，次要元素必须主动让位（`yielding`：降低不透明度、退入背景景深、弱化描边），把视觉重心完全交给当前动作主体。

### 6. 先验收再批量制作（First Shot Approval & Visual QA）
- **首镜样板审核（First Shot Approval）**：在全量渲染前，必须先完成第 1 个核心样板镜头的配音与渲染（`out/first_shot.mp4` 及关键帧样片），审核构图、材质、动作节奏、字幕和视觉风格，确立全片视觉基准。
- **全片 Contact Sheet 视觉 QA**：生成每个镜头「开始 / 动作节拍中点 / 结束」关键帧的 Contact Sheet（`out/contact_sheet.png`）与连续帧抽样，通过自动化指标与 `Visual QA` 审美核验（无卡片堆砌、无文字截断溢出、无跳变穿帮）后方可交付成片。

---

## 二、 四角色导演工作流（Multi-Agent Direction Pipeline）

严禁让单个 Agent 一边写口播文案、一边直接往固定动画模板里填字。必须按以下四个职责解耦推进：

| 角色 | 核心问题 | 职责定义 | 规范文件 |
| --- | --- | --- | --- |
| **Agent 1: Scriptwriter**<br>文案编剧 | **我要告诉观众什么？** | 深入研究项目源码与实时 GitHub 数据，确定讲解逻辑与故事主线，撰写口播文案（切分短语锚点 `narration_phrases`），提取真实代码/命令/指标素材。 | [`agents/scriptwriter.md`](./agents/scriptwriter.md) |
| **Agent 2: Visual Director**<br>视觉导演 | **观众应该看到什么，才能理解我说的话？** | 确立全片 `global_art_direction`，将每段口播转化为 `visual_world`（空间与主次实体物体）与 `visual_choreography`（分步物理动作节拍、镜头运动、景别变化与视觉让位）。 | [`agents/visual_director.md`](./agents/visual_director.md) |
| **Agent 3: Motion Designer**<br>动效设计师 | **如何真正实现这个画面？** | 将视觉导演的分镜与短语级语音时间锚点（`phrase_timings` / `beat_timings`）对接，驱动 Remotion 3D/2.5D 物理场景组件与连续样条相机，必要时扩展专属物体动效组件。 | [`agents/motion_designer.md`](./agents/motion_designer.md) |
| **QA: Visual QA**<br>视觉审核 | **画面审美、动作与节奏是否达标？** | 执行首镜样板验收（First Shot Approval）与全片 Contact Sheet 审片，拦截卡片堆砌、色彩花哨、动作缺失、元素过载或穿帮跳变，驱动修复闭环。 | [`agents/visual_qa.md`](./agents/visual_qa.md) |

---

## 三、 视觉动作分镜 Schema 概览（`visual_choreography`）

完整规范详见 [`references/scene-schema.md`](./references/scene-schema.md)。每个镜头必须明确交代：**空间环境是什么、主次物体是什么、每个节拍发生什么物理变化、摄像机如何配合、其他元素如何让位**：

```json
{
  "id": "scene_03",
  "title": "信息过滤与提纯机制",
  "continuity_group": "filter_lab_sequence",
  "narration": "系统会自动过滤无用信息，只留下重要内容。",
  "visual_intent": "展示信息过滤与提纯机制",
  "art_direction": {
    "style": "premium_3d_editorial",
    "theme": "dark_cinematic",
    "lighting": "soft_studio",
    "material": "translucent_glass",
    "accent_color": "#78A9FF",
    "element_budget": 4
  },
  "visual_world": {
    "environment": "minimal_physical_laboratory",
    "primary_object": "3d_filter_machine",
    "secondary_objects": [
      "information_particles",
      "waste_container",
      "purified_object"
    ]
  },
  "visual_choreography": [
    {
      "beat": "信息进入",
      "phrase_anchor": "系统会自动过滤无用信息",
      "action": "particles_flow",
      "target": "information_particles",
      "description": "大量信息实体沿空间曲线进入过滤装置",
      "camera": "slow_dolly_in",
      "shot_scale": "wide",
      "yielding": "废料回收区与提纯晶体保持低对比度退后"
    },
    {
      "beat": "过滤发生",
      "phrase_anchor": "过滤无用信息",
      "action": "separate",
      "target": "information_particles",
      "description": "无效信息向下分流，有效信息继续前进",
      "camera": "track_horizontal",
      "shot_scale": "medium",
      "yielding": "入口粒子流减弱，焦点锁定过滤核心分流阀"
    },
    {
      "beat": "提纯完成",
      "phrase_anchor": "只留下重要内容",
      "action": "transform",
      "target": "purified_object",
      "description": "有效信息凝聚成一个清晰、完整的实体",
      "camera": "close_up",
      "shot_scale": "close_up",
      "yielding": "过滤装置退入浅景深背景，聚光灯单独照亮提纯实体"
    }
  ],
  "text_overlays": [
    {
      "text": "过滤无用信息",
      "role": "annotation"
    }
  ]
}
```

---

## 四、 标准执行流程（v4 Pipeline）

### 步骤 1：剖析仓库与实时数据核查 (`analyze_repo.py`)
```bash
python scripts/analyze_repo.py --path <目标项目路径> --output workspace/repo_profile.json
```

### 步骤 2：启动文案编剧与视觉导演子 Agent 生成 `workspace/storyboard.json`
1. 启动 **Scriptwriter**（[`agents/scriptwriter.md`](./agents/scriptwriter.md)）：输出 `workspace/script_draft.json` 与 `workspace/research.md`（严禁使用过时 Star 数据，必须拆解出短语锚点与真实代码/界面素材）。
2. 启动 **Visual Director**（[`agents/visual_director.md`](./agents/visual_director.md)）：将 `workspace/script_draft.json` 转化为符合 [`references/scene-schema.md`](./references/scene-schema.md) v4 规范的 `workspace/storyboard.json`。
   - **硬性门禁**：`build_video.py` 已彻底取消 `generate_default_storyboard()` 自动降级！若 `workspace/storyboard.json` 缺失或未通过 v4 Schema 校验，构建将立即报错终止。

### 步骤 3：配音合成、短语级时间锚点对齐与首镜样板审核（First Shot Approval）
```bash
# 校验 v4 分镜 + 生成含短语/节拍级时间锚点的配音 + 渲染第 1 镜样板视频与关键帧
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --first-shot
```
- 检查 `out/first_shot.mp4` 与 `out/first_shot_sheet.png`，由 **Visual QA**（[`agents/visual_qa.md`](./agents/visual_qa.md)）完成首镜审美确认，不达标则由 **Motion Designer**（[`agents/motion_designer.md`](./agents/motion_designer.md)）或 **Visual Director** 修正后再继续。

### 步骤 4：全片渲染与 Contact Sheet 视觉验收 (`visual_qa.py`)
```bash
# 1. 全片参数构建与配音对齐
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav

# 2. 生成全片各镜头 Start/Mid/End 及动作节拍 Contact Sheet 与连续帧 QA 报告
python scripts/visual_qa.py --props workspace/build_props.json --output-dir out/qa

# 3. 审核通过后并发渲染完整高清 MP4 与封面
npx remotion render src/index.ts TutorialVideo out/tutorial.mp4 --props=workspace/build_props.json --concurrency=4
npm run still
```
