# `storyboard.json` 视觉导演分镜 Schema（v4 · Visual Choreography 版）

在 `repo-to-video` v4 中，分镜数据结构完成了根本性范式转移：
- **彻底废除以卡片为中心的数据结构**（不再使用 `cards`、`stack_items`、`pain_points`、`raw_inputs`、`distilled_outputs` 等往固定模板填文字的字段）。
- **全面转向以「空间、实体、动作节拍与镜头调度（Visual Choreography）」为核心的导演分镜结构**。
- **核心铁律**：动画必须由**物体的行为与状态变化**来表达文案，而不是让物体充当承载文字的卡片。

---

## 一、 顶层数据结构 (`storyboard.json`)

```jsonc
{
  "schema_version": "4.0",
  "repo_name": "mem0",
  "repo_url": "https://github.com/mem0ai/mem0",
  "repo_type": "RUNNABLE", // RUNNABLE | SKILL
  "video_title": "Mem0 架构深度拆解：AI 长期记忆的物理提纯与混合检索",
  "chapters": ["问题本质", "信息过滤与提纯", "时空状态演进", "多层混合架构", "真实代码接入"],
  "global_art_direction": {
    "aesthetic": "Premium Editorial Tech Explainer",
    "default_theme": "dark_cinematic", // dark_cinematic | light_editorial | mixed_editorial
    "palette": {
      "background_dark": "#0B0D12",
      "background_light": "#F6F5F0",
      "surface_dark": "#131722",
      "surface_light": "#FFFFFF",
      "text_primary_dark": "#F3F4F6",
      "text_primary_light": "#111318",
      "muted": "#8B95A5",
      "primary_accent": "#78A9FF"
    },
    "lighting_preset": "soft_studio", // soft_studio | dramatic_rim | editorial_daylight
    "camera_philosophy": "continuous_narrative_flow",
    "max_element_budget": 4
  },
  "scenes": [
    /* SceneV4[] */
  ]
}
```

---

## 二、 单镜头 Schema 详解 (`SceneV4`)

每一个镜头（Scene）都必须明确回答视觉导演的五个问题：
1. **这幕戏的视觉意图是什么？**（`visual_intent`）
2. **它的艺术风格、灯光、材质和唯一主强调色是什么？**（`art_direction`）
3. **观众处在什么空间环境里，画面中的主角物体和配角物体分别是什么？**（`visual_world`）
4. **随着口播推进，每个节拍（Beat）里哪个物体发生了什么物理变化，摄像机如何运动，其他元素如何让位？**（`visual_choreography`）
5. **画面上仅需保留哪一两条极简批注？**（`text_overlays`）

### 标准结构示例（以「信息过滤与提纯」为例）

```json
{
  "id": "scene_03",
  "chapter": "信息过滤与提纯",
  "title": "信息过滤与提纯机制",
  "continuity_group": "memory_pipeline_lab",
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
    ],
    "object_labels": {
      "3d_filter_machine": "语义提纯核心",
      "information_particles": "原始对话流",
      "waste_container": "冗余噪音回收区",
      "purified_object": "高价值事实晶体"
    }
  },
  "visual_choreography": [
    {
      "beat": "信息进入",
      "phrase_anchor": "系统会自动过滤",
      "action": "particles_flow",
      "target": "information_particles",
      "description": "大量信息实体沿空间曲线进入过滤装置",
      "camera": "slow_dolly_in",
      "shot_scale": "wide",
      "yielding": "waste_container 与 purified_object 保持低对比度退后"
    },
    {
      "beat": "过滤发生",
      "phrase_anchor": "无用信息",
      "action": "separate",
      "target": "information_particles",
      "description": "无效信息向下分流，有效信息继续前进",
      "camera": "track_horizontal",
      "shot_scale": "medium",
      "yielding": "入口粒子流减弱，焦点锁定过滤分流阀门"
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

## 三、 字段规范与词典（与 Remotion 动效引擎直接对接）

### 1. `art_direction`（镜头艺术指导）

| 字段 | 类型 | 必填 | 可选值与说明 |
| --- | --- | --- | --- |
| `style` | `string` | 是 | `"premium_3d_editorial"`（默认 3D 编辑演示）、`"light_editorial"`（浅色编辑风）、`"dark_cinematic"`（深色电影风）、`"product_demo"`（真实产品与代码实操）、`"mechanism_3d"`（3D 物理机制演示） |
| `theme` | `string` | 否 | `"dark"`（碳黑 `#0B0D12`）或 `"light"`（暖白 `#F6F5F0`）。若不填，自动根据 `style` 推导（`light_editorial` 为 `"light"`，其余默认 `"dark"`） |
| `lighting` | `string` | 是 | `"soft_studio"`（柔和演播室光）、`"dramatic_rim"`（高对比轮廓光）、`"editorial_daylight"`（干净自然天光） |
| `material` | `string` | 是 | `"translucent_glass"`（半透明磨砂玻璃）、`"brushed_aluminum"`（拉丝阳极铝）、`"matte_ceramic"`（哑光陶瓷）、`"anodized_dark"`（深色金属）、`"editorial_paper"`（暖白编辑纸张）、`"authentic_screen"`（真实屏幕视口） |
| `accent_color` | `string` | 是 | 单镜头唯一主强调色 HEX（如 `"#78A9FF"` 电光冰蓝、`"#34D399"` 信号翠绿、`"#F59E0B"` 琥珀金、`"#F43F5E"` 警示朱红、`"#A78BFA"` 架构紫） |
| `element_budget` | `number` | 否 | 同屏最大主要视觉元素数量，默认 `4`，严禁超过 `5` |

---

### 2. `visual_world`（三维空间与实体道具）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `environment` | `string` | 是 | 空间环境基底：<br>- `"minimal_physical_laboratory"`（极简物理实验室）<br>- `"editorial_ drafting_table"` / `"editorial_canvas"`（浅色理性编辑画布）<br>- `"dark_architectural_stage"`（深色建筑级空间舞台）<br>- `"authentic_developer_workspace"`（真实代码与终端演播室） |
| `primary_object` | `string \| object` | 是 | 镜头核心实体装置。支持直接传字符串 ID（如 `"3d_filter_machine"`）或传 `{ "id": "...", "type": "...", "label": "..." }`。<br>内置物理装置模型库：<br>- `"3d_filter_machine"`：透明物理过滤与提纯舱<br>- `"layered_architecture"`：多层精密结构模组（可沿 Z 轴拆解、扫描、总线通信与合体）<br>- `"state_timeline_track"`：物理时间刻度导轨与状态印章块<br>- `"multi_probe_router"`：多通道信号探针与汇聚棱镜<br>- `"physical_balance_stage"`：空间负载对比台（超载坍塌 vs 索引抽卡）<br>- `"authentic_code_viewport"`：真实源码编辑器与高亮透视镜<br>- `"authentic_terminal_bench"`：真实命令行执行工作台<br>- `"authentic_ui_showcase"`：真实网页/产品界面演示台 |
| `secondary_objects` | `Array<string \| object>` | 是 | 配合核心装置发生行为的次要实体列表（1~3 个），例如 `["information_particles", "waste_container", "purified_object"]` |
| `object_labels` | `Record<string, string>` | 否 | 为 `primary_object` 与 `secondary_objects` 提供精炼中文标签映射，用于空间微距标注 |
| `authentic_assets` | `object` | 否 | 当展示真实项目素材时传入：<br>`{ "filename": "src/main.py", "language": "python", "code_snippet": "...", "highlight_lines": [2, 3], "terminal_commands": ["..."], "terminal_output": ["..."], "metrics": [{"value": "90%", "label": "Token 节省"}], "screenshot_url": "..." }` |

---

### 3. `visual_choreography`（分步动作节拍序列）

每个镜头必须包含 `2 ~ 4` 个动作节拍（Beat），按时间顺序执行，并与口播短语对齐：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `beat` | `string` | 是 | 节拍名称（如 `"信息进入"`、`"过滤发生"`、`"提纯完成"`） |
| `phrase_anchor` | `string` | 推荐 | 对应 `narration` 中的短语文本，`tts_generator.py` 据此计算该动作节拍的精确起止帧 `[startFrame, endFrame]` |
| `action` | `string` | 是 | 物理动作动词（驱动 Remotion 动效状态机）：<br>- **过滤/流转类**：`"particles_flow"`（粒子流涌入）、`"separate"`（物理分流/筛除）、`"transform"`（凝聚/形态转化）<br>- **架构/结构类**：`"explode_layers"`（Z轴分层拆解）、`"scan_layer"`（单层聚焦扫描）、`"connect_bus"`（层间光路/数据总线贯通）、`"assemble"`（精密合体）<br>- **时序/状态类**：`"append_state"`（新增状态块）、`"anchor_timestamp"`（加盖时间印章）、`"trace_lineage"`（新旧状态演进连线）<br>- **多路信号/路由类**：`"emit_probes"`（发射多路探针）、`"weigh_signals"`（信号权重充能对比）、`"converge_result"`（多路汇聚生成最终实体）<br>- **对比/负载类**：`"overload_collapse"`（冗余堆叠超载告警）、`"precision_extract"`（精准抽取目标实体）、`"compare_split"`（同屏推拉实测对比）<br>- **真实代码/产品类**：`"reveal_ui"`（展开真实界面/工作区）、`"highlight_code"`（聚焦核心代码行并暗化其余行）、`"type_command"`（终端执行真实命令）、`"execute_output"`（呈现真实运行输出与指标） |
| `target` | `string` | 是 | 当前动作作用的物体标识（对应 `primary_object` 或 `secondary_objects` 中的某一项） |
| `description` | `string` | 是 | 对该动作节拍具体物理变化与视觉表现的清晰描述 |
| `camera` | `string` | 否 | 摄像机配合动作：<br>- `"slow_dolly_in"`（缓慢推进）<br>- `"dolly_out"`（拉远展示全局）<br>- `"close_up"`（推至特写）<br>- `"macro_focus"`（微距锁定细节）<br>- `"track_horizontal"`（水平跟拍）<br>- `"track_vertical"`（垂直跟拍）<br>- `"orbit_left"` / `"orbit_right"`（环绕运镜）<br>- `"isometric_tilt"`（3/4 等轴测俯仰）<br>- `"top_down_overview"`（俯瞰全局）<br>- `"steady_hold"`（克制定机位观察物体内部运动） |
| `shot_scale` | `string` | 否 | 景别：`"wide"`（全景）、`"medium"`（中景）、`"close_up"`（特写）、`"macro"`（微距） |
| `yielding` | `string` | 否 | 镜头让位说明：描述非焦点元素如何退后、虚化或降低对比度 |
| `payload` | `object` | 否 | 当前节拍附加数据（如聚焦代码行号 `"lines": [3,4]`、高亮指标 `"metric": "0.15s"` 等） |

---

### 4. `text_overlays`（克制的屏幕文字批注）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | `string` | 是 | 批注文本（建议 ≤ 14 字，精炼点题，绝不重复大段口播） |
| `role` | `string` | 是 | `"annotation"`（动作批注）、`"metric"`（核心数据指标）、`"caption"`（编辑式小标题）、`"callout"`（部件引线标注） |
| `beat_index` | `number` | 否 | 指定在第几个 `beat`（0-based）激活显示；若省略则随主动作自然浮现 |

---

## 四、 典型连续叙事分镜范例（同一 3D 场景连续运镜）

当讲解一个包含多阶段的技术架构时，**不要生硬切换不同模板**，而是使用相同的 `continuity_group` 与 `visual_world.environment`，让摄像机在同一个三维空间内通过景别与焦点转换完成连续叙事：

```json
[
  {
    "id": "scene_04_arch_explode",
    "chapter": "多层混合架构",
    "title": "三层存储结构的空间拆解",
    "continuity_group": "hybrid_storage_chamber",
    "narration": "为了兼顾速度与关系推理，系统将存储引擎拆解为底层流水账本、中层语义向量库与顶层关系图谱。",
    "visual_intent": "在同一物理空间内拆解三层存储模组，建立空间层级直觉",
    "art_direction": {
      "style": "mechanism_3d",
      "theme": "dark_cinematic",
      "lighting": "dramatic_rim",
      "material": "brushed_aluminum",
      "accent_color": "#78A9FF",
      "element_budget": 4
    },
    "visual_world": {
      "environment": "dark_architectural_stage",
      "primary_object": "layered_architecture",
      "secondary_objects": ["sqlite_ledger_slab", "vector_index_slab", "graph_topology_slab"],
      "object_labels": {
        "sqlite_ledger_slab": "L1 · SQLite 审计流水层",
        "vector_index_slab": "L2 · Qdrant 语义向量层",
        "graph_topology_slab": "L3 · Kuzu 实体关系网"
      }
    },
    "visual_choreography": [
      {
        "beat": "整体呈现与轴向拆解",
        "phrase_anchor": "为了兼顾速度与关系推理",
        "action": "explode_layers",
        "target": "layered_architecture",
        "description": "原本紧密咬合的三层金属玻璃模组沿 Z 轴平稳分离，露出内部光路结构",
        "camera": "isometric_tilt",
        "shot_scale": "wide",
        "yielding": "背景网格压暗至 15%，仅保留模组轮廓高光"
      },
      {
        "beat": "逐层扫描定位",
        "phrase_anchor": "拆解为底层流水账本、中层语义向量库与顶层关系图谱",
        "action": "scan_layer",
        "target": "graph_topology_slab",
        "description": "扫描光束自下而上依次点亮 L1 账本、L2 向量阵列与 L3 拓扑节点网",
        "camera": "track_vertical",
        "shot_scale": "medium",
        "yielding": "未被扫描到的层级自动降低亮度至 35%"
      }
    ],
    "text_overlays": [
      { "text": "三层异构存储协同", "role": "annotation" }
    ]
  },
  {
    "id": "scene_05_arch_bus",
    "chapter": "多层混合架构",
    "title": "跨层检索信号协同与合体",
    "continuity_group": "hybrid_storage_chamber",
    "narration": "当查询发起时，三层存储并行响应，光路总线将语义相似度与图谱关系实时汇聚成最终答案。",
    "visual_intent": "保持上一幕的三维模组空间，推进至特写展示跨层信号汇聚与模组合体",
    "art_direction": {
      "style": "mechanism_3d",
      "theme": "dark_cinematic",
      "lighting": "dramatic_rim",
      "material": "translucent_glass",
      "accent_color": "#34D399",
      "element_budget": 4
    },
    "visual_world": {
      "environment": "dark_architectural_stage",
      "primary_object": "layered_architecture",
      "secondary_objects": ["optical_data_bus", "converged_answer_crystal"],
      "object_labels": {
        "optical_data_bus": "跨层 RRF 融合总线",
        "converged_answer_crystal": "高置信度召回结果"
      }
    },
    "visual_choreography": [
      {
        "beat": "总线贯通",
        "phrase_anchor": "当查询发起时，三层存储并行响应",
        "action": "connect_bus",
        "target": "optical_data_bus",
        "description": "垂直光纤总线贯穿三层模组，脉冲信号沿总线高速向上汇聚",
        "camera": "orbit_right",
        "shot_scale": "medium",
        "yielding": "三层模组转为半透明线框态，突出内部穿梭的翡翠色信号脉冲"
      },
      {
        "beat": "合体与结晶输出",
        "phrase_anchor": "实时汇聚成最终答案",
        "action": "assemble",
        "target": "converged_answer_crystal",
        "description": "三层模组精密回弹合体，顶部凝聚出高亮答案晶体",
        "camera": "close_up",
        "shot_scale": "close_up",
        "yielding": "底座模组虚化退后，焦点完全锁定顶部答案晶体"
      }
    ],
    "text_overlays": [
      { "text": "多路信号实时汇聚", "role": "annotation" }
    ]
  }
]
```
