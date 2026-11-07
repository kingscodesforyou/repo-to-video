# 视觉演示视频叙事与导演框架 (Storyboard & Direction Framework v4)

制作 GitHub 项目技术深度讲解视频，最忌讳的是「照着 README 念经 + 往卡片模板里填字」。本规范基于 `repo-to-video` v4 的六大核心原则，定义了从叙事编排到视觉导演的标准结构。

---

## 一、 核心叙事与导演递进模型

无论目标仓库是可运行工程（`RUNNABLE`）还是智能体技能/规范库（`SKILL`），全片均遵循 **「问题物理化 ➔ 核心机制连续拆解 ➔ 真实代码/界面验证 ➔ 总结收束」** 的导演结构：

### 第 1 幕：痛点具象化与首镜定调（First Shot Benchmark）
- **视觉模态**：`light_editorial`（浅色编辑风）或 `dark_cinematic`（深色电影风）
- **核心实体**：`physical_balance_stage` 或 `authentic_ui_showcase`
- **导演编排**：
  - Beat 1：展示传统方案在面对高并发/海量信息时的结构超载或失控状态（`overload_collapse`），摄像机从全景缓慢推进（`slow_dolly_in`）。
  - Beat 2：引入目标项目的核心机制，多余元素退后让位（`yielding`），精准提取目标实体（`precision_extract`），摄像机推至特写定格。
- **验收要求**：本镜头作为 **First Shot Approval（首镜样板审核）** 的基准镜头，必须先单独渲染通过验收后再批量制作后续镜头。

### 第 2 ~ 4 幕：核心机制连续视觉拆解（Continuous Mechanism Choreography）
- **视觉模态**：`mechanism_3d` / `premium_3d_editorial`
- **连续性设计**：
  - 将紧密关联的 2~3 个技术阶段归入同一个 `continuity_group`（如 `core_engine_chamber`），保持同一三维物理空间；
  - 随讲解深入，依次调度 `3d_filter_machine`（过滤提纯）、`layered_architecture`（Z轴分层拆解与总线贯通）、`state_timeline_track`（时间轴印章演进）或 `multi_probe_router`（多路信号探针汇聚）；
  - 通过改变景别（`wide` ➔ `medium` ➔ `close_up` ➔ `macro`）和焦点让位来推进叙事，而不是生硬切换背景模板。

### 第 5 幕：真实产品与代码实操验证（Authentic Assets Showcase）
- **视觉模态**：`product_demo`（真实素材优先）
- **核心实体**：`authentic_code_viewport` / `authentic_terminal_bench` / `authentic_ui_showcase`
- **导演编排**：
  - 直接调取仓库中的真实源码文件、真实 CLI 命令与运行输出（写入 `visual_world.authentic_assets`）；
  - Beat 1：展开真实工作区视口（`reveal_ui`）；
  - Beat 2：聚焦高亮最关键的 2~4 行核心调用代码，其余代码行自动降低不透明度至 30% 让位（`highlight_code`）；
  - Beat 3：执行真实终端命令并呈现响应指标（`type_command` ➔ `execute_output`）。

### 第 6 幕：核心收益收束与开源指引（Editorial Outro）
- **视觉模态**：与首镜呼应的 `dark_cinematic` 或 `light_editorial`
- **导演编排**：核心架构晶体平稳合体（`assemble`），浮现项目真实仓库地址与核心实测指标。
