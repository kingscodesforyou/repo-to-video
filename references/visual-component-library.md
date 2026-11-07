# 视觉组件素材库与三层可组合 Renderer Registry 规范 (`visual-component-library.md` · v4.3)

为了彻底解决视觉导演分镜与实际渲染代码之间的断层问题，`repo-to-video` v4.3 建立了以根目录 [`renderer-registry.json`](../renderer-registry.json) 为唯一数据源的**三层可组合动画系统（3-Tier Composable Animation Architecture）**。

---

## 一、 三层可组合动画系统（3-Tier Architecture）

| 层级 | 接口名称 | 职责与粒度 | 代码与注册位置 |
| --- | --- | --- | --- |
| **Tier 1** | `SceneRenderer` | 空间舞台、环境网格、灯光、槽位布局与组件路由 | [`renderer-registry.json`](../renderer-registry.json) `renderers` + [`RendererRegistry.tsx`](../templates/src/registry/RendererRegistry.tsx) |
| **Tier 2** | `ObjectRenderer` | 单个 3D / 2.5D 物理实体的三维坐标 `[x, y, z]`（供相机 `lookAt` 对焦）、材质与几何形态 | [`renderer-registry.json`](../renderer-registry.json) `object_renderers` + [`ThreeHybridCanvas.tsx`](../templates/src/components/ThreeHybridCanvas.tsx) |
| **Tier 3** | `MotionPrimitive` | **可执行**的原子运动学原语（`particles_flow`, `separate`, `transform`, `explode_layers`, `dispatch_tool`, `send_request`, `stream_response` 等）：显式 `IMPLEMENTATIONS` 映射、未知动作抛错、节拍内局部进度、跨节拍状态继承；每个原语有方向/距离/终态行为测试 | [`renderer-registry.json`](../renderer-registry.json) `motion_primitives` + [`MotionPrimitives.ts`](../templates/src/registry/MotionPrimitives.ts) `MOTION_PRIMITIVE_REGISTRY` + [`motion.test.ts`](../templates/tests/motion.test.ts) |

> **v4.3 执行保障**：registry 与 schema 的根目录文件是唯一数据源，`templates/src/registry/` 下为其生成镜像；`sync_registry.py --check` 以字节相等强制无漂移（`REGISTRY_DRIFT` 阻断）。`MOTION_PRIMITIVE_REGISTRY` 的键集合必须与 registry `motion_primitives` 完全一致（parity 测试），声明缺 `required_payload`/`optional_payload`/`payload_schema` 或实现未注册均在构建期抛错，绝不静默降级。

---

## 二、 六大核心 SceneRenderer 组件规格

### 1. `particle_filter_v1`（别名：`PhysicalSimulation` · 组件：`FilterLaboratoryStage`）
- **支持动作 (`supportedActions`)**：`particles_flow`、`separate`、`collide`、`split`、`merge`、`transform`、`crystallize`
- **支持物体 (`supportedObjects`)**：`3d_filter_machine`、`information_particles`、`signal_particles`、`waste_container`、`purified_object`、`morphing_crystal`、`particle_attractor`
- **可调参数 (`beat.payload`)**：`particle_count` (6~14)、`valid_ratio` (0.1~0.9)、`flow_speed` (0.5~2.0)、`gravity` (0.5~2.0)、`crystal_facets`、`token_labels`
- **标准 Benchmark**：[`evals/01_ai_info_filter.json`](../evals/01_ai_info_filter.json)

### 2. `architecture_v1`（别名：`MechanicalStructure` · 组件：`LayeredArchitectureStage`）
- **支持动作 (`supportedActions`)**：`explode_layers`、`disassemble`、`rotate_rotor`、`interlock`、`scan_layer`、`connect_bus`、`assemble`
- **支持物体 (`supportedObjects`)**：`layered_architecture`、`mechanical_core`、`rotor_ring_assembly`、`sqlite_ledger_slab`、`vector_index_slab`、`graph_topology_slab`、`converged_answer_crystal`
- **可调参数 (`beat.payload`)**：`explode_distance` (20~60)、`focus_layer` (0~2)、`rotor_rpm`、`layer_count`
- **标准 Benchmark**：[`evals/02_software_architecture.json`](../evals/02_software_architecture.json)

### 3. `dataflow_router_v1`（别名：`DataFlow` · 组件：`MultiProbeRouterStage`）
- **支持动作 (`supportedActions`)**：`emit_probes`、`weigh_signals`、`route_stream`、`route_parallel`、`dispatch_tool`、`send_request`、`stream_response`、`connect_bus`、`converge_result`
- **支持物体 (`supportedObjects`)**：`multi_probe_router`、`spatial_topology_graph`、`optical_data_bus`、`vector_probe`、`lexical_probe`、`graph_probe`、`temporal_probe`、`network_nodes`、`agent_dispatcher_core`、`skill_tool_slot`、`api_client_origin`、`api_gateway_endpoint`、`request_packets`、`response_payload_crystal`、`converged_answer_crystal`
- **可调参数 (`beat.payload`)**：`probe_count`、`weights`、`confidence_target`、`pulse_speed`
- **标准 Benchmark**：[`evals/03_agent_skill_workflow.json`](../evals/03_agent_skill_workflow.json)、[`evals/05_api_call_lifecycle.json`](../evals/05_api_call_lifecycle.json)

### 4. `timeline_state_v1`（别名：`SystemArchitecture` · 组件：`StateTimelineStage`）
- **支持动作 (`supportedActions`)**：`append_state`、`anchor_timestamp`、`trace_lineage`、`overload_collapse`、`precision_extract`
- **支持物体 (`supportedObjects`)**：`state_timeline_track`、`physical_balance_stage`、`historical_state_v1`、`incremental_state_v2`、`timestamped_latest_state`、`indexed_fact_node`
- **可调参数 (`beat.payload`)**：`state_count`、`overload_tokens`、`precision_tokens`

### 5. `product_interface_v1`（别名：`ProductInterface` · 组件：`AuthenticProductDemoStage`）
- **支持动作 (`supportedActions`)**：`reveal_ui`、`highlight_code`、`type_command`、`execute_output`、`navigate`、`interact`、`compare_split`
- **支持物体 (`supportedObjects`)**：`authentic_code_viewport`、`authentic_terminal_bench`、`authentic_ui_showcase`、`benchmark_telemetry_panel`
- **强制资产门禁**：必须提供真实的 `visual_world.authentic_assets`（`code_snippet` 或 `terminal_commands`），严禁将兜底示例标记为 `AUTHENTIC SOURCE`。
- **标准 Benchmark**：[`evals/04_cli_tool_exec.json`](../evals/04_cli_tool_exec.json)

### 6. `kinetic_thesis_v1`（别名：`KineticTypography` · 组件：`KineticTypographyStage`）
- **支持动作 (`supportedActions`)**：`kinetic_reveal`、`editorial_focus`、`metric_counter`、`chapter_transition`
- **支持物体 (`supportedObjects`)**：`editorial_thesis_monolith`、`hero_metric_counter`、`architectural_axiom_card`
- **使用限制**：全片最多使用 `1 ~ 2` 次，严禁用来代替核心技术机制的物理演示。
