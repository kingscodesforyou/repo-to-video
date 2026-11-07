---
name: repo-to-video
description: >-
  将 GitHub 项目（包括 Web/CLI/AI 等可运行项目，以及 Agent Skill、Prompt 提示词、规则库等项目）
  转化为「Premium Editorial Tech Explainer」级别的可执行视觉编排视频（v4.1）。
  采用「Scriptwriter ➔ Visual Director ➔ Motion Designer ➔ Visual QA ➔ Final Rendering」五阶段必经流程，
  内置 Renderer Registry（六大混合渲染组件库：Remotion+CSS / SVG / Three.js 3D 网格与粒子 / 真实界面）、
  双层声学音画同步（短语分段实测 + 词级能量对齐）与四层视觉 QA（Schema / Render / Motion / Semantic QA）。
---

# Executable Visual Choreography System (`repo-to-video` v4.1)

`repo-to-video` v4.1 从「视觉分镜生成」升级为**可执行的视觉编排系统（Executable Visual Choreography System）**，彻底打通从文案理解、视觉导演、组件能力注册与代码实现，到基于真实画面的语义审美验收闭环。

---

## 一、 v4.1 核心架构与六大铁律

### 1. Renderer Registry 与六大视觉组件库（杜绝模板断层與默认降级）
- 详见 [`references/visual-component-library.md`](./references/visual-component-library.md) 与 [`templates/src/registry/registry_manifest.json`](./templates/src/registry/registry_manifest.json)。
- 每个场景渲染组件（`SceneRenderer`）显式声明其能力边界（`supportedActions`、`supportedObjects`、`supportedCameras`、`supportedEnvironments`、`payloadSchema`）：
  1. `PhysicalSimulation`：粒子系统与多面体结晶形态变化（`particles_flow`, `separate`, `collide`, `split`, `merge`, `transform`, `crystallize`）
  2. `MechanicalStructure`：3D 机械结构拆解、旋转与重组（`explode_layers`, `disassemble`, `rotate_rotor`, `interlock`, `scan_layer`, `assemble`）
  3. `DataFlow`：多路数据流、三维空间拓扑网络与探针汇聚（`emit_probes`, `weigh_signals`, `route_stream`, `connect_bus`, `converge_result`）
  4. `SystemArchitecture`：系统时序状态演进与空间负载对比（`append_state`, `anchor_timestamp`, `trace_lineage`, `overload_collapse`, `precision_extract`）
  5. `ProductInterface`：真实代码聚焦、CLI 终端实操与产品 UI 交互（`reveal_ui`, `highlight_code`, `type_command`, `execute_output`, `navigate`, `interact`, `compare_split`）
  6. `KineticTypography`：高级编辑动态排版与核心命题揭示（`kinetic_reveal`, `editorial_focus`, `metric_counter`, `chapter_transition`）
- **零静默降级**：若分镜请求的动作或物体超出已注册组件能力，**Motion Designer 必须开发并注册新组件（或调整为可执行方案）**，构建脚本发现未注册能力将直接报错阻断。

### 2. 混合渲染引擎（Hybrid Rendering Stack）
按镜头需求组合四种渲染技术，突破纯 CSS 2.5D 的表现上限：
- **Remotion + CSS**：高清排版、字幕、界面转场、材质面板与景深模糊让位（`yielding`）。
- **SVG**：空间贝塞尔流线、光纤数据总线、工程标尺与引线标注。
- **Three.js / 3D 顶点网格与空间拓扑 (`ThreeHybridCanvas.tsx`)**：真实三维二十面体顶点形变与法线光照（`MorphingPolyhedron3D`）、多轴机械分离涡轮环（`MechanicalRotor3D`）、深度排序三维空间拓扑网络（`SpatialTopologyNetwork3D`）。
- **真实屏幕/素材 (`ProductInterface`)**：项目真实代码、终端执行与产品界面演示。

### 3. 所有分镜字段真实驱动渲染（杜绝虚假描述）
- **`description` 绝不默认上屏**：`beat.description` 仅用于导演备注、Motion Designer 参考与 QA 核对，严禁在画面左下角渲染成文字说明卡片。
- **`visual_world.environment` 真实映射**：映射为对应的空间透视焦距、地平线反射、坐标轴参考面与布光系统。
- **`yielding` 真实控制物理让位**：自动解析并驱动非焦点物体的不透明度（`opacity`）、景深模糊（`filter: blur`）、Z轴后退（`translateZ`）与缩放。
- **`beat.payload` 真实传递参数**：直接控制粒子数量、分流重力、分层间距、聚焦层号、信号权重与高亮代码行号。

### 4. 统一元素预算口径（`element_budget <= 4`）
- 每个镜头同屏最多 **4 个主要视觉元素**（`1` 个 `primary_object` + 最多 `3` 个 `secondary_objects`）。
- **集合体规则**：粒子系统（如 `information_particles`、`network_nodes`）内部的粒子实例作为单一集合体（`collective_group`）计为 **1 个整体元素**。
- 屏幕批注 `text_overlays` 每个镜头最多 **2 条**。

### 5. 双层精准音画同步与严格 `phrase_anchor` 门禁
- **第一层（短语分段实测对齐）**：`tts_generator.py` 对每个口播短语独立合成/测量真实音频时长后再拼接，获取毫秒级精确的 `phrase_timings`。
- **第二层（词级声学能量强制对齐）**：基于 WAV PCM 声学能量包络核（Acoustic Energy CDF）对齐词元时间（`word_timings`）。
- **四大硬性时间轴校验**：① 每个动作必须有匹配口播原文的 `phrase_anchor`；② 严禁重复匹配同一句话；③ 动作顺序必须与口播顺序严格单调递增；④ **彻底废除未匹配动作的静默比例回退**。

### 6. `hero_scene_id` 样板审核与四层 Visual QA
- 由 Visual Director 指定最能代表全片核心机制与视觉质量的 `hero_scene_id` 进行样板审核（`--hero-shot`），而非机械测试第 1 幕标题。
- 全片通过 **Schema QA ➔ Render QA ➔ Motion QA（覆盖每个节拍起中止与每个交界连续帧）➔ Semantic QA（真实画面五问审片）** 四层验收后方能交付。

---

## 二、 五阶段必经执行流程（Mandatory 5-Stage Pipeline）

| 阶段 | 角色 / 工具 | 必经职责与产出 | 规范文件 |
| --- | --- | --- | --- |
| **Stage 1** | **Scriptwriter**<br>文案编剧 | 剖析源码与实时 GitHub 数据（`analyze_repo.py`），确定讲解逻辑，撰写口播并切分短语锚点，提取真实代码/命令素材，输出 `workspace/script_draft.json`。 | [`agents/scriptwriter.md`](./agents/scriptwriter.md) |
| **Stage 2** | **Visual Director**<br>视觉导演 | 设定 `global_art_direction` 与 `hero_scene_id`，为每幕设计 `visual_world`、`visual_choreography`、`yielding` 与 `camera`，输出 `workspace/storyboard.json`。 | [`agents/visual_director.md`](./agents/visual_director.md) |
| **Stage 3** | **Motion Designer**<br>动效设计师（必经！） | 对照 [`registry_manifest.json`](./templates/src/registry/registry_manifest.json) 检查所有镜头能力：匹配时绑定 `renderer_id` 与 `payload`；不匹配时编写并注册新 Remotion/Three 组件（或调整为可执行方案），输出 `workspace/motion_plan.json`。 | [`agents/motion_designer.md`](./agents/motion_designer.md) |
| **Stage 4** | **Visual QA**<br>四层视觉审核 | 先渲染并审核 `hero_scene_id` 样板镜头（`--hero-shot`）；再对全片执行 Schema / Render / Motion / Semantic 四层 QA，直接审阅 Contact Sheet 与连续帧图片并完成五问核验。 | [`agents/visual_qa.md`](./agents/visual_qa.md) |
| **Stage 5** | **Final Rendering**<br>成片交付 | 四层 QA 状态为 `APPROVED` 后，并发渲染完整高清 MP4 与封面。 | `scripts/build_video.py` |

---

## 三、 标准执行命令

```bash
# 1. 扫描仓库并获取实时 GitHub Star 与权威数据
python scripts/analyze_repo.py --path <目标项目路径> --output workspace/repo_profile.json

# 2. 依次执行 Stage 1 (Scriptwriter) -> Stage 2 (Visual Director) -> Stage 3 (Motion Designer)
#    产出并通过 v4.1 校验的 workspace/storyboard.json

# 3. Stage 4a: 渲染并审核 hero_scene_id 代表性样板镜头 (Hero Shot Approval)
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --hero-shot

# 4. Stage 4b: 全片构建并执行四层 Visual QA (生成每个节拍关键帧 Contact Sheet、交界连续帧与 Semantic QA 审片单)
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --run-qa

# 5. Stage 5: Visual QA 审阅图片确认 APPROVED 后，渲染最终高清 MP4
npx remotion render src/index.ts TutorialVideo out/tutorial.mp4 --props=workspace/build_props.json --concurrency=4
npm run still
```
