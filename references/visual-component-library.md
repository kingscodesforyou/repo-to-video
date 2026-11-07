# 视觉组件素材库与 Renderer Registry 规范 (`visual-component-library.md` · v4.1)

为了彻底解决「视觉导演想象了一百种动画，但渲染引擎只认识几种固定模板」的断层问题，`repo-to-video` v4.1 建立了经过严格审核的**六大视觉组件库（Visual Component Library）**与**能力注册系统（Renderer Registry）**。

所有组件能力声明统一维护在 [`templates/src/registry/registry_manifest.json`](../templates/src/registry/registry_manifest.json)，代码实现位于 [`templates/src/registry/RendererRegistry.tsx`](../templates/src/registry/RendererRegistry.tsx) 与混合三维引擎 [`templates/src/components/ThreeHybridCanvas.tsx`](../templates/src/components/ThreeHybridCanvas.tsx)。

---

## 一、 混合渲染技术栈分工（Hybrid Rendering Architecture）

不要为了使用某种技术而硬套技术，按镜头表达需求组合使用以下四种渲染层：

| 渲染技术 | 核心职责 | 典型负责对象 |
| --- | --- | --- |
| **Remotion + CSS** | 高清排版、字幕、界面视口、精准材质面板、2.5D 景深让位 | 标题栏、代码高亮窗、材质卡片、模糊/不透明度让位 (`yielding`) |
| **SVG** | 精密空间贝塞尔曲线、动态数据光路、流程图、引线标注 | 粒子入射流线、跨层光纤总线、工程准星标尺 |
| **Three.js / 3D Vertex & Mesh (`ThreeHybridCanvas.tsx`)** | 真实三维多面体顶点形变、机械涡轮环旋转拆解、三维空间拓扑网络（含深度排序与 Lambert 法线光照） | `MorphingPolyhedron3D`（二十面体结晶）、`MechanicalRotor3D`（多轴涡轮分离环）、`SpatialTopologyNetwork3D`（三维空间节点网） |
| **Authentic Screen / Recording** | 真实 GitHub 页面、终端实操、产品界面与代码运行输出 | `authentic_code_viewport`、`authentic_terminal_bench`、`authentic_ui_showcase` |

---

## 二、 六大核心视觉组件规格（Audited Component Families）

### 1. `PhysicalSimulation` · 粒子系统与物理形态仿真
- **支持动作 (`supportedActions`)**：`particles_flow`（粒子涌入）、`separate`（重力/阀门分流）、`collide`（碰撞激波）、`split`（分裂）、`merge`（融合）、`transform`（形态转化）、`crystallize`（多面体结晶）
- **支持物体 (`supportedObjects`)**：`3d_filter_machine`、`information_particles`、`signal_particles`、`waste_container`、`purified_object`、`morphing_crystal`、`particle_attractor`
- **可调参数 (`beat.payload`)**：
  - `particle_count` (`number`, 6~14)：粒子实体数量（作为单一集合体计入 1 个元素预算）
  - `valid_ratio` (`number`, 0.1~0.9)：有效信号占比
  - `flow_speed` (`number`, 0.5~2.0)：流转与涡轮转速倍率
  - `gravity` (`number`, 0.5~2.0)：废料分流下坠重力加速度
  - `token_labels` (`string[]`)：粒子携带的短标签（≤ 6 字）
- **推荐使用场景**：数据过滤去噪、信息提纯、Token 切块、碎片特征聚合成结构化实体。
- **不适合使用场景**：静态目录介绍、超过 3 个步骤的宏观业务流程。
- **视觉 QA 标准**：必须清晰看到左侧粒子沿曲线进入、中央 3D 涡轮环旋转分离、底部废料下坠、右侧三维二十面体从离散碎片收拢结晶 (`MorphingPolyhedron3D`) 的完整物理过程。

---

### 2. `MechanicalStructure` · 3D 机械结构拆解与装配
- **支持动作 (`supportedActions`)**：`explode_layers`（Z轴分层炸开）、`disassemble`（结构解耦）、`rotate_rotor`（转子旋转）、`interlock`（咬合锁定）、`scan_layer`（单层聚焦扫描）、`assemble`（精密回弹合体）
- **支持物体 (`supportedObjects`)**：`layered_architecture`、`mechanical_core`、`rotor_ring_assembly`、`sqlite_ledger_slab`、`vector_index_slab`、`graph_topology_slab`、`converged_answer_crystal`
- **可调参数 (`beat.payload`)**：
  - `explode_distance` (`number`, 20~60)：层间 Z 轴分离间距
  - `focus_layer` (`number`, 0~2)：当前节拍单独高亮聚焦的层索引（其余层自动触发 `yielding` 退后虚化）
  - `rotor_rpm` (`number`)：核心转子角速度
- **推荐使用场景**：三层存储引擎解剖、编译器前中后端分层、系统内核与插件解耦架构。
- **不适合使用场景**：平铺直叙的功能清单、无层级关系的并列工具。
- **视觉 QA 标准**：层数严禁超过 3 层（加上 1 个主核心共 4 个元素）；聚焦某一层时，其余层必须明显降暗/虚化让位。

---

### 3. `DataFlow` · 多路数据流、三维空间网络与信号路由
- **支持动作 (`supportedActions`)**：`emit_probes`（发射探针）、`weigh_signals`（权重实时充能）、`route_stream`（流式路由）、`connect_bus`（总线贯通）、`converge_result`（多路收敛合成）
- **支持物体 (`supportedObjects`)**：`multi_probe_router`、`spatial_topology_graph`、`optical_data_bus`、`vector_probe`、`lexical_probe`、`graph_probe`、`temporal_probe`、`network_nodes`
- **可调参数 (`beat.payload`)**：
  - `weights` (`number[]`)：各路通道实时权重得分（如 `[94, 88, 96]`）
  - `confidence_target` (`number`)：合成棱镜最终置信度百分比
- **推荐使用场景**：多路混合检索（Vector + BM25 + Graph）、MoE 专家路由、三维知识图谱关联推理。
- **不适合使用场景**：单一线性脚本执行。
- **视觉 QA 标准**：右侧三维空间拓扑网络（`SpatialTopologyNetwork3D`）必须随帧连续旋转并展示脉冲沿边向中心 CORE 节点汇聚。

---

### 4. `SystemArchitecture` · 时序状态演进与空间负载对比
- **支持动作 (`supportedActions`)**：`append_state`（追加状态块）、`anchor_timestamp`（加盖时间印章）、`trace_lineage`（演进溯源连线）、`overload_collapse`（冗余超载告警）、`precision_extract`（O(1) 精准抽取）
- **支持物体 (`supportedObjects`)**：`state_timeline_track`、`physical_balance_stage`、`historical_state_v1`、`incremental_state_v2`、`timestamped_latest_state`、`indexed_fact_node`
- **可调参数 (`beat.payload`)**：
  - `overload_tokens` (`string`)：传统方案负载指标（如 `"26,000 TOKENS"`）
  - `precision_tokens` (`string`)：精准方案负载指标（如 `"3 NODES / 0.14s"`）
- **推荐使用场景**：Append-only 状态防篡改演进、长上下文超载 vs 精准记忆索引对比。
- **不适合使用场景**：纯文字优缺点表格罗列。

---

### 5. `ProductInterface` · 真实产品 UI、代码聚焦与终端实操
- **支持动作 (`supportedActions`)**：`reveal_ui`（展开真实视口）、`highlight_code`（行级代码聚焦与非核心行暗化）、`type_command`（确定性命令敲击）、`execute_output`（真实输出呈现）、`navigate`、`interact`、`compare_split`
- **支持物体 (`supportedObjects`)**：`authentic_code_viewport`、`authentic_terminal_bench`、`authentic_ui_showcase`、`benchmark_telemetry_panel`
- **可调参数 (`beat.payload`)**：
  - `lines` (`number[]`)：当前节拍高亮聚焦的代码行号（如 `[3, 4]`），未命中的代码行自动降至 `28%` 不透明度让位。
- **推荐使用场景**：项目真实 SDK 调用代码精读、CLI 安装与运行演示、真实产品界面展示。
- **不适合使用场景**：严禁用于展示虚构伪代码。

---

### 6. `KineticTypography` · 高级编辑动态排版与核心命题揭示
- **支持动作 (`supportedActions`)**：`kinetic_reveal`、`editorial_focus`、`metric_counter`、`chapter_transition`
- **支持物体 (`supportedObjects`)**：`editorial_thesis_monolith`、`hero_metric_counter`、`architectural_axiom_card`
- **可调参数 (`beat.payload`)**：`headline`、`subheadline`、`metric_value`
- **使用限制**：全片最多使用 `1 ~ 2` 次（仅限开场核心命题定调或结尾总结），**严禁用来代替核心技术机制的物理演示**！

---

## 三、 自定义组件扩展协议（Motion Designer Extension Protocol）

当视觉导演设计的镜头超出了上述 6 大内置组件的能力范围时，**Motion Designer 严禁将其强行塞入不匹配的现有模板**，必须执行以下扩展步骤：
1. 在 `templates/src/registry/` 中编写新的 `SceneRenderer` 实现并调用 `registerCustomSceneRenderer(...)` 注册；
2. 将新组件的 `id`、`supportedActions`、`supportedObjects` 同步登记到 `templates/src/registry/registry_manifest.json`；
3. 运行 `python scripts/build_video.py` 通过注册表门禁校验。
