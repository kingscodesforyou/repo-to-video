# `storyboard.json` 可执行视觉编排 Schema（v4.1 · Executable Visual Choreography 版）

在 `repo-to-video` v4.1 中，分镜 Schema 不仅是视觉导演的创意描述，更是直接受 **`build_video.py` 字段级白名单、`Renderer Registry` 能力校验门禁与 `tts_generator.py` 声学时间轴对齐** 约束的可执行契约。

---

## 一、 v4.1 五条强制校验规则（Schema Gates）

1. **字段级白名单检查（彻底阻断新旧结构混用）**：
   - 严禁在 `scene` 中出现任何旧版模板或卡片字段（`type`、`data`、`stack_items`、`cards`、`pain_points`、`magic_points`、`raw_inputs`、`distilled_outputs`、`teacher_note`）。即便同时写了 `visual_choreography`，只要出现上述任一旧字段，构建立即报错终止。
2. **统一元素预算口径（`element_budget <= 4`）**：
   - 每个镜头同屏最多 **4 个主要视觉元素**：`1` 个 `primary_object` + 最多 `3` 个 `secondary_objects`（`len(secondary_objects) <= 3`）。
   - **集合体计入规则**：粒子系统或网络集合（`information_particles`、`signal_particles`、`network_nodes`、`data_packets`）内部的多个粒子实例作为单一集合体（`collective_group`）计为 **1 个整体元素**。
   - 画面文字批注 `text_overlays` 每个镜头最多 **2 条**。
3. **`Renderer Registry` 能力绑定校验**：
   - 每个镜头的 `renderer_id`（或 `primary_object` + `action` 组合）、`visual_world.environment`、`beat.camera` 与 `beat.payload` 参数名，必须在 [`templates/src/registry/registry_manifest.json`](../templates/src/registry/registry_manifest.json) 中真实注册。未知能力严禁静默退化到默认模板。
4. **`phrase_anchor` 严格顺序匹配（废除静默比例回退）**：
   - 每个 `visual_choreography` 节拍必须提供 `phrase_anchor`，且必须是 `narration` 原文中的真实子串；
   - 不允许两个节拍重复匹配同一位置；
   - 节拍锚点在口播中的出现顺序必须严格单调递增。
5. **所有视觉指令字段真实执行，杜绝把 `description` 当作底部卡片渲染**：
   - `beat.description` 仅用于导演备注、Motion Designer 参考与 Semantic QA 核对，**默认绝不渲染上屏**；
   - `visual_world.environment` 真实驱动空间透视焦距、地平线反射、网格与三维坐标参考面；
   - `beat.yielding` 真实驱动非焦点物体的不透明度（`opacity`）、景深模糊（`blur`）与 Z 轴后退；
   - `beat.payload` 真实驱动组件物理参数。

---

## 二、 顶层数据结构 (`storyboard.json`)

```jsonc
{
  "schema_version": "4.1",
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
    /* SceneV4_1[] */
  ]
}
```

---

## 三、 单镜头完整示例 (`SceneV4_1`)

```json
{
  "id": "scene_01",
  "renderer_id": "PhysicalSimulation",
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
      "yielding": {
        "dim_opacity": 0.35,
        "blur_px": 2.0,
        "push_back_z": -40
      },
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
      "yielding": "purified_object 保持退后待机状态",
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
      "yielding": "3d_filter_machine 与 waste_container 虚化退入浅景深背景 (25%)",
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

## 四、 字段白名单与注册表映射速查

- **受支持的 `renderer_id` 及对应 `action` / `primary_object` / `payloadSchema`**：详见 [`references/visual-component-library.md`](./visual-component-library.md) 与 [`templates/src/registry/registry_manifest.json`](../templates/src/registry/registry_manifest.json)。
- **受支持的 `visual_world.environment`**：
  - `"minimal_physical_laboratory"`（极简物理实验室：64px 标尺网格 + 地平线基准 + 1800px 透视）
  - `"dark_architectural_stage"`（深色建筑级空间舞台：80px 柱网 + 轮廓光 + 1600px 透视）
  - `"editorial_drafting_table"`（浅色理性制图桌面：暖白底色 + 四周工程准星标尺 + 2000px 透视）
  - `"editorial_canvas"`（浅色大留白编辑画布）
  - `"authentic_developer_workspace"`（真实代码与终端演播室）
  - `"spatial_network_void"`（三维 X/Y/Z 坐标参考网络空间）
- **受支持的 `beat.camera`**：
  - `"slow_dolly_in"`、`"dolly_out"`、`"close_up"`、`"macro_focus"`、`"track_horizontal"`、`"track_vertical"`、`"orbit_left"`、`"orbit_right"`、`"isometric_tilt"`、`"top_down_overview"`、`"steady_hold"`。
