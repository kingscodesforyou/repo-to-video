---
name: repo-to-video
description: >-
  将 GitHub 项目（包括 Web/CLI/AI 等可运行项目，以及 Agent Skill、Prompt 提示词、规则库等项目）
  转化为「Premium Editorial Tech Explainer」级别的可执行视觉编排视频（v4.2）。
  采用「Scriptwriter ➔ Visual Director ➔ Motion Designer ➔ Visual QA ➔ Final Rendering」五阶段必经流程，
  内置唯一数据源 renderer-registry.json 与三层可组合动画引擎（SceneRenderer + ObjectRenderer + MotionPrimitive）、
  双层强制音画同步（短语分段实测 + WordBoundary / 声学能量对齐）、哈希绑定的四层视觉 QA 与 5 个标准 Visual Benchmark。
---

# Executable Visual Choreography System (`repo-to-video` v4.2)

`repo-to-video` v4.2 建立了从文案理解、视觉导演、三层可组合动画注册表（[`renderer-registry.json`](./renderer-registry.json)），到哈希绑定四层视觉 QA 与硬性交付门禁的完整闭环。

---

## 一、 v4.2 核心架构与七大铁律

### 1. 唯一数据源 `renderer-registry.json` 与三层可组合动画系统（零启发式猜测与零静默降级）
- 根目录 [`renderer-registry.json`](./renderer-registry.json)（同步镜像至 [`templates/src/registry/registry_manifest.json`](./templates/src/registry/registry_manifest.json)）作为 Visual Director、Motion Designer、Python 校验器、Remotion 渲染引擎与 Visual QA 的**唯一共同数据源**。
- 采用 **三层可组合动画架构（3-Tier Composable Animation Architecture）**：
  - **Tier 1 · `SceneRenderer`（舞台环境与槽位）**：
    1. `particle_filter_v1`（别名 `PhysicalSimulation` / 组件 `FilterLaboratoryStage`）：粒子流、涡轮分离与二十面体结晶
    2. `architecture_v1`（别名 `MechanicalStructure` / 组件 `LayeredArchitectureStage`）：3D 多层架构拆解、单层扫描与咬合合体
    3. `dataflow_router_v1`（别名 `DataFlow` / 组件 `MultiProbeRouterStage`）：多路探针路由、Agent Skill 调度、API 调用全链路与三维空间拓扑网络
    4. `timeline_state_v1`（别名 `SystemArchitecture` / 组件 `StateTimelineStage`）：时序状态演进与空间负载对比
    5. `product_interface_v1`（别名 `ProductInterface` / 组件 `AuthenticProductDemoStage`）：真实源码聚焦、CLI 终端实操与实测指标面板
    6. `kinetic_thesis_v1`（别名 `KineticTypography` / 组件 `KineticTypographyStage`）：高级编辑动态排版与核心命题碑
  - **Tier 2 · `ObjectRenderer`（含 3D 空间坐标 `[x, y, z]` 的实体规格）**：供 3D 相机自动执行焦点目标 `lookAt` 追踪。
  - **Tier 3 · `MotionPrimitive`（可复用动作原语）**：`particles_flow`、`separate`、`transform`、`explode_layers`、`scan_layer`、`connect_bus`、`assemble`、`dispatch_tool`、`send_request`、`stream_response`、`route_parallel`、`converge_result` 等。
- **严格 `renderer_id` 路由**：每个镜头必须显式声明 `renderer_id`，`ChoreographedScene.tsx` 与 `build_video.py` 严格按 `renderer_id` 路由与校验，彻底废除根据物体名或动作字符串的启发式兜底。

### 2. 正式成片彻底关闭 `description` 说明卡片与遥测标签
- `beat.description` 仅作为导演备注和 QA 审片参考，**正式成片完全关闭 `description` 画面展示**。
- 右上角 `RENDERER / CAM / TARGET` 遥测标签与调试备注仅在 `debugMode: true` 时显示；屏幕仅保留必要的章节标题、节拍指示与最多 2 条短批注（`text_overlays`）。

### 3. 结构化 `yielding` 数组与真实 `payload` / `authentic_assets` 驱动
- **结构化镜头让位（Structured `yielding`）**：支持结构化数组（如 `[{"target": "3d_filter_machine", "opacity": 0.25, "scale": 0.9, "zOffset": -60, "blur": 3.0}, {"target": "background_grid", "opacity": 0.15}]`），真实驱动非焦点物体与 `Background.tsx` 空间网格的透明度、缩放、Z 轴位移与景深模糊。
- **真实代码门禁**：使用 `product_interface_v1` 时必须提供真实的 `visual_world.authentic_assets`（`code_snippet` 或 `terminal_commands`），严禁将兜底伪代码标记为 `AUTHENTIC SOURCE`。

### 4. 真实 3D 相机系统（`rotZ` Roll + 目标 `lookAt` 追踪 + 连续镜头姿态继承）
- 完整插值并应用 `translate3d(tx, ty, tz) scale(...) rotateX(...) rotateY(...) rotateZ(...)`。
- 根据当前节拍 `beat.target` 在 `renderer-registry.json` 中的 3D 坐标 `[x, y, z]` 自动解算相机 `lookAt` 摇摄偏移。
- 属于同一 `continuity_group` 的相邻镜头自动继承上一镜结束帧的 3D 相机姿态（`initialCameraPose`），实现无缝连续运镜。

### 5. 统一三项核心规范（版本 `v4.2` · 元素预算 `<= 4` · 样板文件名）
- **版本号统一**：全仓库统一为 `v4.2`。
- **元素预算统一（`element_budget <= 4`）**：每个镜头同屏最多 **4 个主要视觉元素**（`1` 个 `primary_object` + 最多 `3` 个 `secondary_objects`，粒子群作为单一集合体计为 1 个元素）。
- **样板审核文件统一**：统一输出并兼容 `out/first_shot.mp4`（及 `out/hero_shot.mp4`）、`out/qa/first_shot_sheet.png`（及 `out/qa/hero_shot_sheet.png`）、`workspace/build_props.first_shot.json`（及 `workspace/build_props.hero_shot.json`）。

### 6. 双层强制音画同步与时间字段统一
- `tts_generator.py` 结合短语分段实测时长、TTS 原生 `WordBoundary` 时间戳捕获与 WAV PCM 声学能量包络 CDF 实现毫秒级对齐。
- 统一在 `phrase_timings`、`word_timings`、`beat_timings` 中同时输出 `start_frame`/`end_frame` 与 `startFrame`/`endFrame`。

### 7. 哈希绑定的四层 Visual QA 与硬性交付门禁
- `semantic_qa_checklist.json` 中的每个镜头审批绑定 `scene_signature_hash`（分镜内容 + 渲染器版本 + 渲染关键帧 SHA-256）；修改分镜后旧审批自动失效。
- `visual_qa.py` 与 `build_video.py --run-qa` / `--render-final` 实施强退出码门禁：`overall_status != "APPROVED"` 时直接以非零退出码（`SystemExit(1)`）阻断交付。

---

## 二、 五阶段必经执行流程（Mandatory 5-Stage Pipeline）

| 阶段 | 角色 / 工具 | 必经职责与产出 | 规范文件 |
| --- | --- | --- | --- |
| **Stage 1** | **Scriptwriter**<br>文案编剧 | 剖析源码与实时 GitHub 数据（`analyze_repo.py`），撰写口播并切分短语锚点，提取真实代码/命令素材，输出 `workspace/script_draft.json`。 | [`agents/scriptwriter.md`](./agents/scriptwriter.md) |
| **Stage 2** | **Visual Director**<br>视觉导演 | 对照 [`renderer-registry.json`](./renderer-registry.json) 设定 `hero_scene_id` 与每个镜头的 `renderer_id`、`visual_world`、`visual_choreography`、结构化 `yielding` 与 `camera`，输出 `workspace/storyboard.json`。 | [`agents/visual_director.md`](./agents/visual_director.md) |
| **Stage 3** | **Motion Designer**<br>动效设计师（必经！） | 核验 `renderer_id` 与动作/物体/参数匹配度；不匹配时通过三层可组合架构扩展并注册新组件，输出 `workspace/motion_plan.json`。 | [`agents/motion_designer.md`](./agents/motion_designer.md) |
| **Stage 4** | **Visual QA**<br>四层视觉审核 | 先渲染并审核样板镜头（`--first-shot` / `--hero-shot`）；再对全片执行 Schema / Render / Motion / Hash-Bound Semantic 四层 QA，直接审阅图片并完成五问核验。 | [`agents/visual_qa.md`](./agents/visual_qa.md) |
| **Stage 5** | **Final Rendering**<br>成片交付 | 核验 `visual_qa_report.json` 为 `APPROVED` 后（`--render-final`），导出最终高清 MP4 与封面。 | `scripts/build_video.py` |

---

## 三、 标准执行命令与 Visual Benchmark

```bash
# 0. 运行 5 个标准视觉基准测试套件 (evals/01..05) 与 4 项负向门禁回归测试
python scripts/run_evals.py

# 1. 扫描仓库并获取实时 GitHub Star 与权威数据
python scripts/analyze_repo.py --path <目标项目路径> --output workspace/repo_profile.json

# 2. 依次执行 Stage 1 (Scriptwriter) -> Stage 2 (Visual Director) -> Stage 3 (Motion Designer)
#    产出并通过 v4.2 校验的 workspace/storyboard.json

# 3. Stage 4a: 渲染并审核代表性样板镜头 (生成 out/first_shot.mp4 与 out/qa/first_shot_sheet.png)
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --first-shot

# 4. Stage 4b: 全片构建并执行四层 Visual QA (未通过 APPROVED 将返回非零退出码阻断)
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --run-qa

# 5. Stage 5: 强门禁核验 APPROVED 后渲染最终高清 MP4
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --render-final
```
