# `storyboard.json` 教学型视觉编排 Schema（v4.4 · Pedagogical Visual Choreography 版）

在 `repo-to-video` v4.4 中，分镜 Schema 是受 **根目录唯一数据源 [`renderer-registry.json`](../renderer-registry.json)、共享 [`animation-contract.schema.json`](../animation-contract.schema.json)（Python jsonschema 与 TS Ajv 双端同构校验）、`sync_registry.py --check` 镜像漂移门禁、`build_video.py` 字段级白名单、`visual_mode`（`2d_editorial` / `3d_spatial` / `hybrid`）强门禁与 `tts_generator.py` 强制时间轴对齐** 约束的可执行契约。

---

## 一、 v4.4 七条强制校验规则（Schema Gates）

1. **强制显式声明 `visual_mode` 与教学三要素**：
   - 每个 Scene 必须显式指定：
     - `"visual_mode"`: `"2d_editorial"` | `"3d_spatial"` | `"hybrid"`
     - `"learning_objective"`: 本镜头教学目标（非空字符串）
     - `"visual_explanation"`: 画面如何帮助观众理解（非空字符串）
     - `"expected_understanding"`: 观众看完这一幕应明白什么（非空字符串）
   - **`2d_editorial` 硬门禁**：禁止 `orbit_left`、`orbit_right`、`isometric_tilt`、`top_down_overview` 等 3D 倾斜相机；禁止 `yielding` 中出现非零 `zOffset`；禁止绑定纯 3D 渲染器；渲染视口锁定 `perspective: none` 与 `rotX=rotY=rotZ=tz=0`。
   - **`3d_spatial` 硬门禁**：仅限具有真实三维空间教学价值的镜头（粒子过滤、机械拆解、三维空间拓扑），禁止将纯 2D 渲染器声明为 `3d_spatial`。
   - **`hybrid` 硬门禁**：必须使用 3D 空间主体渲染器，且必须提供至少一项 2D 正视信息层（`text_overlays` 或 `visual_world.object_labels`），2D 文字层在独立正交平面 HUD 渲染，绝不随 3D 主体倾斜。
2. **字段级白名单检查（彻底阻断新旧结构混用）**：
   - 严禁在 `scene` 中出现任何旧版模板或卡片字段（`type`、`data`、`stack_items`、`cards`、`pain_points`、`magic_points`、`raw_inputs`、`distilled_outputs`、`teacher_note`）。
3. **显式 `renderer_id` 与唯一数据源 `renderer-registry.json` 校验**：
   - 每个镜头必须显式声明 `renderer_id`：
     - `editorial_2d_v1`（v4.4 新增独立 2D 渲染器：支持 `typography`、`infographic`、`flowchart`、`timeline`、`comparison`、`code_explanation`、`step_by_step`、`cause_effect`）
     - `product_interface_v1`、`kinetic_thesis_v1`、`timeline_state_v1`、`particle_filter_v1`、`architecture_v1`、`dataflow_router_v1`。
4. **统一元素预算口径（`element_budget <= 4`）**：
   - 每个镜头同屏最多 **4 个主要视觉元素**：`1` 个 `primary_object` + 最多 `3` 个 `secondary_objects`。
   - 画面文字批注 `text_overlays` 每个镜头最多 **2 条**。
5. **结构化镜头让位（Structured `yielding` Array）**：
   - 多节拍镜头的每个 `beat` 必须声明结构化 `yielding` 数组（注意：`2d_editorial` 模式下禁止设置非零 `zOffset`）。
6. **真实代码资产门禁（Authentic Assets Gate）**：
   - 凡使用 `product_interface_v1` 的镜头，必须在 `visual_world.authentic_assets` 中提供仓库真实的 `code_snippet` 或 `terminal_commands`。
7. **`phrase_anchor` 严格顺序匹配与关闭上屏 `description`**：
   - 每个 `visual_choreography` 节拍必须提供 `narration` 原文中的真实子串 `phrase_anchor`，严禁重复匹配同一位置，且出现顺序必须严格单调递增。

---

## 二、 顶层数据结构 (`storyboard.json`)

```jsonc
{
  "schema_version": "4.4",
  "repo_name": "mem0",
  "repo_url": "https://github.com/mem0ai/mem0",
  "repo_type": "RUNNABLE",
  "video_title": "AI 为什么聊久了就会忘事？用图书馆编目法讲透 Mem0 长期记忆原理",
  "hero_scene_id": "scene_02",
  "chapters": ["为什么需要长期记忆", "核心工作原理", "真实代码接入"],
  "global_art_direction": {
    "aesthetic": "Premium Editorial Tech Explainer",
    "default_theme": "dark_cinematic",
    "lighting_preset": "soft_studio",
    "camera_philosophy": "continuous_narrative_flow",
    "max_element_budget": 4
  },
  "scenes": [
    /* SceneV4_4[] */
  ]
}
```

---

## 三、 2D 镜头与 Hybrid 镜头示例 (`SceneV4_4`)

### 示例 A：`2d_editorial`（使用 `editorial_2d_v1` 正视流程图，零三维倾斜）

```json
{
  "id": "scene_01_flowchart",
  "renderer_id": "editorial_2d_v1",
  "visual_mode": "2d_editorial",
  "learning_objective": "让零基础观众看懂一条聊天消息从输入到变成长期记忆便签的四个步骤",
  "visual_explanation": "通过从左到右水平排列的四个正交步骤框和动态推进箭头，直观展示信息一步步被筛选和存档的过程",
  "expected_understanding": "观众明白系统不是把原话直接存起来，而是经过了接收、筛除寒暄、提炼重点、写入档案四步处理",
  "chapter": "核心工作原理",
  "title": "四步看懂记忆提炼流程",
  "continuity_group": "pedagogy_2d_flow",
  "narration": "一条普通聊天消息进入系统后，会先筛掉客套寒暄，接着提炼出关键事实，最后写成结构化便签存入档案库。",
  "visual_intent": "使用 2D 正视流程图逐级点亮四个处理阶段，文字与连接线始终保持水平清晰",
  "art_direction": {
    "style": "editorial_motion",
    "theme": "light_editorial",
    "lighting": "editorial_daylight",
    "material": "matte_acrylic",
    "accent_color": "#2563EB",
    "element_budget": 2
  },
  "visual_world": {
    "environment": "editorial_canvas",
    "primary_object": "flowchart_canvas_2d",
    "secondary_objects": [
      "step_board_2d"
    ],
    "object_labels": {
      "flowchart_canvas_2d": "四步记忆提炼主流程",
      "step_board_2d": "步骤要点说明"
    }
  },
  "visual_choreography": [
    {
      "beat": "消息进入与筛除寒暄",
      "phrase_anchor": "会先筛掉客套寒暄",
      "action": "flowchart",
      "target": "flowchart_canvas_2d",
      "description": "点亮前两个流程节点，展示原始对话进入与寒暄筛除",
      "camera": "steady_hold",
      "shot_scale": "wide",
      "yielding": [
        { "target": "step_board_2d", "opacity": 0.4, "scale": 0.96, "blur": 0.5 }
      ],
      "payload": {
        "headline": "从杂乱闲聊到精炼便签的四步流水线",
        "nodes": ["1. 接收原始聊天", "2. 筛除客套寒暄", "3. 提炼关键事实", "4. 写入记忆档案"],
        "edges": ["输入解析", "去噪过滤", "持久化存储"],
        "active_step": 1
      }
    },
    {
      "beat": "提炼事实并写入档案",
      "phrase_anchor": "最后写成结构化便签存入档案库",
      "action": "flowchart",
      "target": "flowchart_canvas_2d",
      "description": "推进至第 3、4 节点，完成整条平面流程图闭环",
      "camera": "slow_dolly_in",
      "shot_scale": "medium",
      "yielding": [
        { "target": "background_grid", "opacity": 0.2 }
      ],
      "payload": {
        "headline": "从杂乱闲聊到精炼便签的四步流水线",
        "nodes": ["1. 接收原始聊天", "2. 筛除客套寒暄", "3. 提炼关键事实", "4. 写入记忆档案"],
        "edges": ["输入解析", "去噪过滤", "持久化存储"],
        "active_step": 3
      }
    }
  ],
  "text_overlays": [
    {
      "text": "先筛除寒暄，只存重点",
      "role": "annotation",
      "beat_index": 1
    }
  ]
}
```
