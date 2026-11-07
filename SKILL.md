---
name: repo-to-video
description: >-
  将 GitHub 项目（包括 Web/CLI/AI 等可运行项目，以及 Agent Skill、Prompt 提示词、规则库等项目）
  转化为「Premium Editorial Tech Explainer」级别的可执行视觉编排视频（v4.3）。
  采用「Scriptwriter ➔ Visual Director ➔ Motion Designer ➔ Visual QA ➔ Final Rendering」五阶段必经流程，
  内置唯一数据源 renderer-registry.json + 共享 animation-contract.schema.json（Python/TS 双端同构校验 + 同步漂移门禁）、
  三层可组合动画引擎（SceneRenderer + ObjectRenderer + 可执行 MotionPrimitive）、
  双层强制音画同步（短语分段实测 + WordBoundary / 声学能量对齐）、构建指纹绑定的四层视觉 QA 与硬交付门禁、
  以及 5 个标准 Visual Benchmark 的真实渲染回归（golden_renders + 显式审批）。
---

# Executable Visual Choreography System (`repo-to-video` v4.3)

`repo-to-video` v4.3 在 v4.2 视觉编排闭环之上，把每一项承诺变成**可执行、可测试、可验证**的能力：共享参数契约双端同构校验、可执行运动学原语与行为测试、构建指纹绑定的 QA→成片硬门禁、真实渲染的视觉回归基线。v4.3 不新增动画组件库，只补齐执行保障。

---

## 一、 v4.3 核心架构与七大铁律

### 1. 唯一数据源 `renderer-registry.json` + 共享契约 schema 与三层可组合动画系统（零启发式猜测与零静默降级）
- 根目录 [`renderer-registry.json`](./renderer-registry.json)（同步镜像至 [`templates/src/registry/registry_manifest.json`](./templates/src/registry/registry_manifest.json)）作为 Visual Director、Motion Designer、Python 校验器、Remotion 渲染引擎与 Visual QA 的**唯一共同数据源**。
- **共享参数契约** [`animation-contract.schema.json`](./animation-contract.schema.json)（镜像至 `templates/src/registry/animation_contract.schema.json`）：JSON Schema draft 2020-12，Python（`scripts/animation_contract.py`）与 TS（`templates/src/registry/AnimationContract.ts`，Ajv2020）双端同构校验同一份 schema；`evals/contract-cases.json` 的共享用例在双端逐条对齐。
- **同步漂移门禁**：`scripts/sync_registry.py` 校验注册表自洽（action 键控、required/optional payload 与 schema 一致）并生成镜像；`--check` 在构建 / `predev` / `prepreview` 时逐字节比对，任何漂移抛 `REGISTRY_DRIFT` 阻断。
- 采用 **三层可组合动画架构（3-Tier Composable Animation Architecture）**：
  - **Tier 1 · `SceneRenderer`（舞台环境与槽位）**：
    1. `particle_filter_v1`（别名 `PhysicalSimulation` / 组件 `FilterLaboratoryStage`）：粒子流、涡轮分离与二十面体结晶
    2. `architecture_v1`（别名 `MechanicalStructure` / 组件 `LayeredArchitectureStage`）：3D 多层架构拆解、单层扫描与咬合合体
    3. `dataflow_router_v1`（别名 `DataFlow` / 组件 `MultiProbeRouterStage`）：多路探针路由、Agent Skill 调度、API 调用全链路与三维空间拓扑网络
    4. `timeline_state_v1`（别名 `SystemArchitecture` / 组件 `StateTimelineStage`）：时序状态演进与空间负载对比
    5. `product_interface_v1`（别名 `ProductInterface` / 组件 `AuthenticProductDemoStage`）：真实源码聚焦、CLI 终端实操与实测指标面板
    6. `kinetic_thesis_v1`（别名 `KineticTypography` / 组件 `KineticTypographyStage`）：高级编辑动态排版与核心命题碑
  - **Tier 2 · `ObjectRenderer`（含 3D 空间坐标 `[x, y, z]` 的实体规格）**：供 3D 相机自动执行焦点目标 `lookAt` 追踪。
  - **Tier 3 · `MotionPrimitive`（可执行动作运动学原语）**：`templates/src/registry/MotionPrimitives.ts` 以显式 `IMPLEMENTATIONS` 映射实现 `particles_flow`、`separate`、`merge`、`transform`、`explode_layers`、`assemble`、`scan_layer`、`connect_bus`、`dispatch_tool`、`send_request`、`stream_response`、`route_parallel`、`converge_result`、`hold` 等全部注册动作；未知动作直接抛错（无通用兜底），`hold` 显式保留上一节拍终态。每个原语的方向符号、距离单调性、终态与跨节拍状态继承由 `templates/tests/motion.test.ts` 行为测试覆盖；六个舞台通过 `createSceneMotionResolver` 以**节拍局部进度**（非整片帧）消费同一运动学状态。
- **严格 `renderer_id` 路由**：每个镜头必须显式声明 `renderer_id`，`ChoreographedScene.tsx` 与 `build_video.py` 严格按 `renderer_id` 路由与校验，彻底废除根据物体名或动作字符串的启发式兜底。

### 2. 正式成片彻底关闭 `description` 说明卡片与遥测标签
- `beat.description` 仅作为导演备注和 QA 审片参考，**正式成片完全关闭 `description` 画面展示**。
- 右上角 `RENDERER / CAM / TARGET` 遥测标签与调试备注仅在 `debugMode: true` 时显示；屏幕仅保留必要的章节标题、节拍指示与最多 2 条短批注（`text_overlays`）。

### 3. 结构化 `yielding` 数组与真实 `payload` / `authentic_assets` 驱动
- **结构化镜头让位（Structured `yielding`）**：仅接受结构化数组（如 `[{"target": "3d_filter_machine", "opacity": 0.25, "scale": 0.9, "zOffset": -60, "blur": 3.0}, {"target": "background_grid", "opacity": 0.15}]`），按精确 ID / `*` / `non_focal` 选择器真实驱动非焦点物体与 `Background.tsx` 空间网格的透明度、缩放、Z 轴位移与景深模糊；旧式字符串 / 对象 yielding 在共享契约与渲染器两端均被拒绝。
- **真实代码门禁**：使用 `product_interface_v1` 时必须提供真实的 `visual_world.authentic_assets`（`code_snippet` 或 `terminal_commands`），严禁将兜底伪代码标记为 `AUTHENTIC SOURCE`。

### 4. 真实 3D 相机系统（`rotZ` Roll + 目标 `lookAt` 追踪 + 连续镜头姿态继承）
- 完整插值并应用 `translate3d(tx, ty, tz) scale(...) rotateX(...) rotateY(...) rotateZ(...)`。
- 根据当前节拍 `beat.target` 在 `renderer-registry.json` 中的 3D 坐标 `[x, y, z]` 自动解算相机 `lookAt` 摇摄偏移。
- 属于同一 `continuity_group` 的相邻镜头自动继承上一镜结束帧的 3D 相机姿态（`initialCameraPose`），实现无缝连续运镜。

### 5. 统一三项核心规范（版本 `v4.3` · 元素预算 `<= 4` · 样板文件名）
- **版本号统一**：对外版本（`schema_version` / `registry_version` / 文档）统一为 `v4.3`；内部函数与类型标识符保留历史命名，不构成版本承诺。
- **元素预算统一（`element_budget <= 4`）**：每个镜头同屏最多 **4 个主要视觉元素**（`1` 个 `primary_object` + 最多 `3` 个 `secondary_objects`，粒子群作为单一集合体计为 1 个元素）。
- **样板审核文件统一**：统一输出并兼容 `out/first_shot.mp4`（及 `out/hero_shot.mp4`）、`out/qa/first_shot_sheet.png`（及 `out/qa/hero_shot_sheet.png`）、`workspace/build_props.first_shot.json`（及 `workspace/build_props.hero_shot.json`）。

### 6. 双层强制音画同步与时间字段统一
- `tts_generator.py` 结合短语分段实测时长、TTS 原生 `WordBoundary` 时间戳捕获与 WAV PCM 声学能量包络 CDF 实现毫秒级对齐。
- 统一在 `phrase_timings`、`word_timings`、`beat_timings` 中同时输出 `start_frame`/`end_frame` 与 `startFrame`/`endFrame`。

### 7. 构建指纹绑定的四层 Visual QA 与硬性交付门禁
- `scripts/build_fingerprint.py` 对**本次实际构建**分类计算 SHA-256：完整 props（含独立 timing/fps/时长/内联代码）、registry 与 schema 镜像、renderer 源码树、public 资产、被引用音频字节、lockfile/配置；任何远程 /  symlink / 逃逸媒体引用直接拒绝。
- `semantic_qa_checklist.json` 与 `visual_qa_report.json` 均绑定 `build_fingerprint` 与逐场景 `scene_signature_hash`（全分镜 + 渲染器版本 + 采样计划 + 关键帧/连续帧 PNG 字节）；修改任何输入后旧审批自动失效。
- `build_video.py --render-final` 的交付门禁调用 `validate_final_qa_report`：要求 **full 模式、四层全部 PASS、逐场景五问布尔真、帧证据与采样计划逐字节一致、指纹完全匹配**；过期 / 抽样 / 仅状态报告一律 `REJECTED_STALE_QA_REPORT` 阻断，无旧报告兜底。
- `visual_qa.py --no-render-frames` 仅在指纹与全部帧哈希匹配时复用图像证据（`validate_qa_frame_cache`），且绝不据此批准 Semantic QA。

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
# 0a. 同步 / 校验唯一数据源镜像（构建与 predev/prepreview 自动 --check，漂移即 REGISTRY_DRIFT）
python scripts/sync_registry.py            # 生成镜像
python scripts/sync_registry.py --check    # 逐字节校验

# 0b. 双端契约 + 运动学行为测试（Python 5+29+22 用例；TS 41 契约 + 24 行为用例）
python -m unittest discover -s scripts -p "test_*.py"
(cd templates && npm run typecheck && npm test)

# 0c. 5 个标准视觉基准：契约模式（快）与真实渲染回归（silent、固定 30fps/40 帧每节拍）
python scripts/run_evals.py                              # 契约 + 负向门禁回归
python scripts/run_evals.py --render --motion-tests \
    --browser-executable "<chrome 路径>"                  # 真实渲染；无基线=BASELINE_MISSING，绝不自动 PASS
python scripts/run_evals.py --render --update-goldens ... # 显式写入 UNAPPROVED 基线候选，需人工/代理审片后审批

# 1. 扫描仓库并获取实时 GitHub Star 与权威数据
python scripts/analyze_repo.py --path <目标项目路径> --output workspace/repo_profile.json

# 2. 依次执行 Stage 1 (Scriptwriter) -> Stage 2 (Visual Director) -> Stage 3 (Motion Designer)
#    产出并通过 v4.3 校验的 workspace/storyboard.json

# 3. Stage 4a: 渲染并审核代表性样板镜头 (生成 out/first_shot.mp4 与 out/qa/first_shot_sheet.png)
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --first-shot

# 4. Stage 4b: 全片构建并执行四层 Visual QA (未通过 APPROVED 将返回非零退出码阻断)
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --voice yali.wav --run-qa

# 5. Stage 5: 强门禁核验构建指纹绑定的 APPROVED 后渲染最终高清 MP4
python scripts/build_video.py --repo <目标项目路径> --workspace workspace --render-final
```
