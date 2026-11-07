---
name: repo-to-video
description: >-
  将 GitHub 项目（包括 Web/CLI/AI 等可运行项目，以及 Agent Skill、Prompt 提示词、规则库等项目）
  转化为「教学型视觉导演系统（Pedagogical Visual Direction System v4.4）」级别的可执行视频。
  采用「Scriptwriter (特级教师六步教学法) ➔ Teaching QA (>=85分硬门禁) ➔ Visual Director (2D/3D/Hybrid 显式决策) ➔ Motion Designer ➔ Visual QA (含 2D QA + 教学语义 QA) ➔ Final Rendering」六阶段必经流程，
  内置唯一数据源 renderer-registry.json（含独立 2D 渲染器 editorial_2d_v1）+ 共享 animation-contract.schema.json & script-contract.schema.json、
  三层可组合动画引擎（SceneRenderer + ObjectRenderer + 可执行 MotionPrimitive）、
  双层强制音画同步、构建指纹绑定的 Visual QA 与硬交付门禁、以及覆盖 2D / 3D / Hybrid 与教学文案的完整 Benchmark 体系。
---

# 教学型视觉导演系统 (`repo-to-video` v4.4)

`repo-to-video` v4.4 在 v4.3 可执行视觉编排闭环之上，重点解决两大核心问题：
1. **视觉系统明确区分 2D、3D 与 Hybrid**：彻底纠正将文字、流程图、代码讲解错误渲染为倾斜 3D 镜头的问题；新增独立 2D 渲染器 `editorial_2d_v1` 与正交平面相机系统，强制 2D 内容 100% 正视水平清晰，3D 仅在机械拆解、粒子物理、三维拓扑等真正具备空间教学价值时使用，Hybrid 模式将 3D 主体与正视不倾斜的 2D 信息层完美结合。
2. **特级教师六步教学法与 Teaching QA 门禁**：将 Scriptwriter 升级为面向零编程基础观众的「首席技术科普名师」，强制执行六步教学法（提出问题 ➔ 生活类比与边界 ➔ 基本概念 ➔ 工作原理四要素 ➔ 真实源码应用 ➔ 总结迁移）与五大术语铁律，并在进入视觉导演前新增 `Teaching QA`（100 分制，`>= 85` 分通过 + 一票否决机制）。

同时 **100% 保留 v4.3 全部核心能力**：`Renderer Registry`、`Animation Contract`、`SceneRenderer / ObjectRenderer / MotionPrimitive` 三层架构、双层音画同步、`Build Fingerprint`、四层 `Visual QA`、`Visual Benchmark` 与最终渲染硬门禁。

---

## 一、 v4.4 核心架构与八大铁律

### 1. 明确区分 `visual_mode`：`2d_editorial` / `3d_spatial` / `hybrid`
- 每个 Scene 必须显式指定 `visual_mode`，并在 `animation-contract.schema.json`、Python `animation_contract.py`、TS `AnimationContract.ts`、`ChoreographedScene.tsx` 与 `Visual QA` 中全链路强制执行：
  - **`2d_editorial`（默认优先）**：适用于文字标题、知识点解释、流程图、架构框图、数据图表、时间线、代码逐行讲解、步骤教学、前后对比、因果关系推导。强制正视平面构图（`perspective: none`, `transformStyle: flat`, `rotX=rotY=rotZ=tz=0`），严禁 `orbit_left` / `orbit_right` / `isometric_tilt` / `top_down_overview` 及非零 `zOffset`。
  - **`3d_spatial`（按需启用）**：仅在机械结构、真实物理运动、粒子系统、三维空间网络、立体结构拆解、物体形态变化等提供明确空间教学价值时使用。
  - **`hybrid`（3D 主体 + 2D 正视层）**：3D 舞台渲染空间主体，同时在外部正交平面 HUD 层（`data-hybrid-2d-layer="true"`）渲染 2D 标签、指标与教学目标，2D 文字层始终保持正视水平，绝不随 3D 主体倾斜。

### 2. 新增独立 2D 渲染器 `editorial_2d_v1`（`Editorial2DRenderer`）
- 在 [`renderer-registry.json`](./renderer-registry.json) 与 [`templates/src/components/Editorial2DCanvas.tsx`](./templates/src/components/Editorial2DCanvas.tsx) 中实现真正的独立 2D 平面教学渲染组件（绝非简单把 3D 相机旋转归零），原生支持 8 大教学动作：
  - `typography`、`infographic`、`flowchart`、`timeline`、`comparison`、`code_explanation`、`step_by_step`、`cause_effect`。

### 3. 特级教师六步教学法与专业术语铁律（`script-contract.schema.json`）
- 面向零编程基础普通观众，强制依次推进：**1. 提出问题 (`problem`) ➔ 2. 生活类比及边界 (`analogy` + `boundary`) ➔ 3. 基本概念 (`concept`) ➔ 4. 工作原理 (`mechanism`: 输入 ➔ 处理 ➔ 为什么这样设计 ➔ 输出) ➔ 5. 实际应用 (`application`: 真实源码) ➔ 6. 总结迁移 (`transfer`)**。
- 首次出现术语必须先白话解释再给术语名，英文缩写首次必展开，严禁术语堆砌与用术语解释术语；语速控制在 **180–220 字/分钟**。

### 4. 新增 Teaching QA 硬门禁（`scripts/teaching_qa.py` & `agents/teaching_qa.md`）
- 按「通俗易懂 25 + 知识完整 25 + 术语解释 20 + 教学逻辑 15 + 案例质量 10 + 语言自然 5 = 100 分」自动评分，通过线 `>= 85` 分；出现核心技术事实错误、未解释关键术语/缩写、缺失类比边界直接**一票否决**。

### 5. 扩展 Storyboard 教学字段与升级 Visual QA（含 2D QA + 教学语义 QA）
- 每个 Scene 必填 `visual_mode`、`learning_objective`、`visual_explanation`、`expected_understanding`。
- `scripts/visual_qa.py` 新增 **2D QA**（检查 2D 镜头零三维倾斜、文字水平、无透视变形、安全区合规）与 **教学语义 QA**（检查画面是否真正帮助理解原理、类比与真实机制对应、信息密度克制），任何违反 `visual_mode` 的镜头一律直接拒绝。

---

## 二、 六阶段必经执行流程（Mandatory 6-Stage Pedagogical Pipeline）

| 阶段 | 角色 / 工具 | 必经职责与产出 | 规范文件 |
| --- | --- | --- | --- |
| **Stage 1** | **Scriptwriter**<br>特级教师编剧 | 剖析源码与实时 GitHub 数据，按强制六步教学法撰写零基础友好文稿，输出 `workspace/script_draft.json`。 | [`agents/scriptwriter.md`](./agents/scriptwriter.md) |
| **Stage 1.5** | **Teaching QA**<br>教学质量审核 | 运行 `scripts/teaching_qa.py` 校验教学六要素、术语白话解释与类比边界（总分 `>= 85` 且零否决项）。 | [`agents/teaching_qa.md`](./agents/teaching_qa.md) |
| **Stage 2** | **Visual Director**<br>教学型视觉导演 | 为每幕显式决策 `visual_mode`（`2d_editorial` / `3d_spatial` / `hybrid`）、`renderer_id` 与教学三要素，输出 `workspace/storyboard.json`。 | [`agents/visual_director.md`](./agents/visual_director.md) |
| **Stage 3** | **Motion Designer**<br>动效设计师 | 核验 2D / 3D / Hybrid 渲染组件、动作原语与结构化 `yielding`，输出 `workspace/motion_plan.json`。 | [`agents/motion_designer.md`](./agents/motion_designer.md) |
| **Stage 4** | **Visual QA**<br>视觉与教学审核 | 执行 Schema (含 2D QA) / Render / Motion / Hash-Bound Semantic (含教学语义 QA) 四层审核。 | [`agents/visual_qa.md`](./agents/visual_qa.md) |
| **Stage 5** | **Final Rendering**<br>成片交付 | 核验构建指纹绑定的 `APPROVED` 报告后（`--render-final`），导出最终高清 MP4。 | `scripts/build_video.py` |

---

## 三、 标准执行命令

```bash
# 0a. 同步 / 校验唯一数据源镜像
python scripts/sync_registry.py
python scripts/sync_registry.py --check

# 0b. 运行全部 Python 与 TypeScript 单元与契约测试
python -m unittest discover -s scripts -p "test_*.py"
npm --prefix templates run typecheck
npm --prefix templates test

# 0c. Stage 1.5 Teaching QA 独立校验
python scripts/teaching_qa.py --script workspace/script_draft.json --out workspace/qa/teaching_qa_report.json

# 0d. 运行 Visual Benchmark（含 2D / 3D / Hybrid 真实渲染与教学文案评测）
python scripts/run_evals.py
python scripts/run_evals.py --render --motion-tests --browser-executable "<chrome 路径>"
```
