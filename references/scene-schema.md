# `storyboard.json` 可执行视觉编排 Schema（v4.3 · Executable Visual Choreography 版）

在 `repo-to-video` v4.3 中，分镜 Schema 是受 **根目录唯一数据源 [`renderer-registry.json`](../renderer-registry.json)、共享 [`animation-contract.schema.json`](../animation-contract.schema.json)（Python jsonschema 与 TS Ajv 双端同构校验）、`sync_registry.py --check` 镜像漂移门禁、`build_video.py` 字段级白名单、结构化 `yielding` 校验门禁与 `tts_generator.py` 强制时间轴对齐** 约束的可执行契约。

---

## 一、 v4.3 六条强制校验规则（Schema Gates）

1. **字段级白名单检查（彻底阻断新旧结构混用）**：
   - 严禁在 `scene` 中出现任何旧版模板或卡片字段（`type`、`data`、`stack_items`、`cards`、`pain_points`、`magic_points`、`raw_inputs`、`distilled_outputs`、`teacher_note`）。即便同时写了 `visual_choreography`，只要出现上述任一旧字段，构建立即报错终止。
2. **显式 `renderer_id` 与唯一数据源 `renderer-registry.json` 校验**：
   - 每个镜头必须显式声明 `renderer_id`（如 `"particle_filter_v1"`、`"architecture_v1"`、`"dataflow_router_v1"`、`"timeline_state_v1"`、`"product_interface_v1"`、`"kinetic_thesis_v1"`，同时兼容分类别名 `"PhysicalSimulation"` 等）。
   - 严禁省略 `renderer_id` 依赖启发式猜测路由；`visual_world.primary_object`、`visual_world.environment`、`beat.action`、`beat.camera` 与 `beat.payload` 必须在 [`renderer-registry.json`](../renderer-registry.json) 中真实支持，且 `beat.payload` 逐字段通过共享 `animation-contract.schema.json` 的按动作 scoped schema 校验（required/optional 与 registry 声明由 `sync_registry.py` 强制一致）。
3. **统一元素预算口径（`element_budget <= 4`）**：
   - 每个镜头同屏最多 **4 个主要视觉元素**：`1` 个 `primary_object` + 最多 `3` 个 `secondary_objects`（`len(secondary_objects) <= 3`）。
   - **集合体计入规则**：粒子系统或网络集合（`information_particles`、`signal_particles`、`network_nodes`、`request_packets`）内部的多个粒子实例作为单一集合体（`collective_group`）计为 **1 个整体元素**。
   - 画面文字批注 `text_overlays` 每个镜头最多 **2 条**。
4. **结构化镜头让位（Structured `yielding` Array）**：
   - 多节拍镜头的每个 `beat` 必须声明**结构化** `yielding` 数组（v4.3 起旧版非数组让位直接拒绝），精确控制每个非焦点物体及背景网格（`background_grid`）的 `opacity`、`scale`、`zOffset` 与 `blur`：
     ```json
     "yielding": [
       { "target": "3d_filter_machine", "opacity": 0.25, "scale": 0.9, "zOffset": -60, "blur": 3.0 },
       { "target": "background_grid", "opacity": 0.15 }
     ]
     ```
5. **真实代码资产门禁（Authentic Assets Gate）**：
   - 凡使用 `product_interface_v1`（或 `ProductInterface`）的镜头，必须在 `visual_world.authentic_assets` 中提供仓库真实的 `code_snippet` 或 `terminal_commands`，严禁使用兜底伪代码冒充 `AUTHENTIC SOURCE`。
6. **`phrase_anchor` 严格顺序匹配与关闭上屏 `description`**：
   - 每个 `visual_choreography` 节拍必须提供 `narration` 原文中的真实子串 `phrase_anchor`，严禁重复匹配同一位置，且出现顺序必须严格单调递增。
   - `beat.description` 仅用于导演备注与 QA 审片参考，**正式成片完全关闭 `description` 展示**（仅 `debugMode: true` 时显示调试信息）。

---

## 二、 顶层数据结构 (`storyboard.json`)

```jsonc
{
  "schema_version": "4.3",
  "repo_name": "mem0",
  "repo_url": "https://github.com/mem0ai/mem0",
  "repo_type": "RUNNABLE", // RUNNABLE | SKILL
  "video_title": "Mem0 架构深度拆解：AI 长期记忆的物理提纯与混合检索",
  "hero_scene_id": "scene_01", // 必填：指定最能代表全片视觉质量的核心机制镜头用于样板审核
  "chapters": ["信息过滤与提纯", "多层混合架构", "真实代码接入"],
  "global_art_direction": {
    "aesthetic": "Premium Editorial Tech Explainer",
    "default_theme": "dark_cinematic", // dark_cinematic | light_editorial | mixed_editorial
    "lighting_preset": "soft_studio", // soft_studio | dramatic_rim | editorial_daylight
    "camera_philosophy": "continuous_narrative_flow",
    "max_element_budget": 4
  },
  "scenes": [
    /* SceneV4_3[] */
  ]
}
```

---

## 三、 单镜头完整示例 (`SceneV4_3`)

```json
{
  "id": "scene_01",
  "renderer_id": "particle_filter_v1",
  "chapter": "信息过滤与提纯",
  "title": "信息过滤与提纯机制",
  "continuity_group": "memory_pipeline_lab",
  "narration": "系统会自动过滤无用信息，将冗余寒暄分流剔除，只留下高价值的重要内容。",
  "visual_intent": "通过 3D 机械涡轮过滤舱与二十面体结晶过程，直观展示去噪与记忆提纯机制",
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
      "3d_filter_machine": "三维涡轮提纯核心",
      "information_particles": "原始对话流",
      "waste_container": "冗余噪音回收仓",
      "purified_object": "高纯度事实晶体"
    }
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
      "yielding": [
        { "target": "waste_container", "opacity": 0.28, "scale": 0.92, "zOffset": -40, "blur": 1.5 },
        { "target": "purified_object", "opacity": 0.32, "scale": 0.94, "zOffset": -36, "blur": 1.5 }
      ],
      "payload": {
        "particle_count": 10,
        "valid_ratio": 0.5,
        "flow_speed": 1.1
      }
    },
    {
      "beat": "过滤发生",
      "phrase_anchor": "将冗余寒暄分流剔除",
      "action": "separate",
      "target": "3d_filter_machine",
      "description": "三维涡轮环高速旋转，无效信息受重力向下分流至回收仓，有效信息继续前进",
      "camera": "track_horizontal",
      "shot_scale": "medium",
      "yielding": [
        { "target": "information_particles", "opacity": 0.35, "scale": 0.94, "zOffset": -30, "blur": 1.0 },
        { "target": "purified_object", "opacity": 0.4, "scale": 0.95, "zOffset": -24, "blur": 1.0 }
      ],
      "payload": {
        "gravity": 1.25
      }
    },
    {
      "beat": "提纯完成",
      "phrase_anchor": "只留下高价值的重要内容",
      "action": "transform",
      "target": "purified_object",
      "description": "有效信息在右侧由离散碎片凝聚结晶为一个完整的三维二十面体晶体",
      "camera": "close_up",
      "shot_scale": "close_up",
      "yielding": [
        { "target": "3d_filter_machine", "opacity": 0.25, "scale": 0.9, "zOffset": -60, "blur": 3.0 },
        { "target": "waste_container", "opacity": 0.2, "scale": 0.88, "zOffset": -60, "blur": 3.5 },
        { "target": "background_grid", "opacity": 0.15 }
      ],
      "payload": {
        "crystal_facets": 20
      }
    }
  ],
  "text_overlays": [
    {
      "text": "过滤无用信息",
      "role": "annotation",
      "beat_index": 1
    }
  ]
}
```

---

## 四、 时间轴对齐字段规范（双命名兼容）

`tts_generator.py` 与 `build_video.py` 输出的 `phrase_timings`、`word_timings`、`beat_timings` 同时提供 `start_frame` / `end_frame` 与 `startFrame` / `endFrame`，确保 Python 校验脚本、Motion Designer 与 Remotion TypeScript 组件完全一致。
