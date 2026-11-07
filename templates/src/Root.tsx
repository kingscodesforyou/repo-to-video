import React from "react";
import { Composition } from "remotion";
import { TutorialVideo, TutorialVideoProps } from "./compositions/TutorialVideo";

const defaultProps: TutorialVideoProps = {
  schemaVersion: "4.2",
  title: "Mem0: AI 长期记忆的物理提纯与多层架构拆解",
  repoName: "mem0",
  repoType: "RUNNABLE",
  chapters: ["信息过滤与提纯", "多层混合架构", "真实代码接入"],
  globalArtDirection: {
    aesthetic: "Premium Editorial Tech Explainer",
    default_theme: "dark_cinematic",
    lighting_preset: "soft_studio",
    camera_philosophy: "continuous_narrative_flow",
    max_element_budget: 4,
  },
  scenes: [
    {
      id: "scene_01",
      renderer_id: "particle_filter_v1",
      chapter: "信息过滤与提纯",
      title: "信息过滤与提纯机制",
      continuity_group: "filter_lab_sequence",
      narration: "系统会自动过滤无用信息，将冗余寒暄分流剔除，只留下重要内容。",
      visual_intent: "展示信息过滤与提纯机制",
      durationInFrames: 150,
      art_direction: {
        style: "premium_3d_editorial",
        lighting: "soft_studio",
        material: "translucent_glass",
        accent_color: "#78A9FF",
        element_budget: 4,
      },
      visual_world: {
        environment: "minimal_physical_laboratory",
        primary_object: "3d_filter_machine",
        secondary_objects: [
          "information_particles",
          "waste_container",
          "purified_object",
        ],
      },
      visual_choreography: [
        {
          beat: "信息进入",
          phrase_anchor: "系统会自动过滤无用信息",
          action: "particles_flow",
          target: "information_particles",
          description: "大量信息实体沿空间曲线进入过滤装置",
          camera: "slow_dolly_in",
          shot_scale: "wide",
          yielding: [
            { target: "waste_container", opacity: 0.28, scale: 0.92, zOffset: -40, blur: 1.5 },
            { target: "purified_object", opacity: 0.32, scale: 0.94, zOffset: -36, blur: 1.5 },
          ],
          payload: {
            particle_count: 10,
            valid_ratio: 0.5,
            flow_speed: 1.1,
          },
        },
        {
          beat: "过滤发生",
          phrase_anchor: "将冗余寒暄分流剔除",
          action: "separate",
          target: "3d_filter_machine",
          description: "无效信息向下分流，有效信息继续前进",
          camera: "track_horizontal",
          shot_scale: "medium",
          yielding: [
            { target: "information_particles", opacity: 0.35, scale: 0.94, zOffset: -30, blur: 1.0 },
            { target: "purified_object", opacity: 0.4, scale: 0.95, zOffset: -24, blur: 1.0 },
          ],
          payload: {
            gravity: 1.2,
          },
        },
        {
          beat: "提纯完成",
          phrase_anchor: "只留下重要内容",
          action: "transform",
          target: "purified_object",
          description: "有效信息凝聚成一个清晰、完整的三维多面体实体",
          camera: "close_up",
          shot_scale: "close_up",
          yielding: [
            { target: "3d_filter_machine", opacity: 0.25, scale: 0.9, zOffset: -60, blur: 3.0 },
            { target: "waste_container", opacity: 0.2, scale: 0.88, zOffset: -60, blur: 3.5 },
            { target: "background_grid", opacity: 0.15 },
          ],
          payload: {
            crystal_facets: 20,
          },
        },
      ],
      text_overlays: [
        {
          text: "过滤无用信息",
          role: "annotation",
          beat_index: 1,
        },
      ],
    },
    {
      id: "scene_02",
      renderer_id: "architecture_v1",
      chapter: "多层混合架构",
      title: "三层异构存储空间拆解",
      continuity_group: "hybrid_storage_chamber",
      narration: "提纯后的记忆实体写入三层异构存储，底层记流水账，顶层构建关系图谱并完成合体。",
      visual_intent: "在同一三维空间拆解三层存储模组并展示精密合体",
      durationInFrames: 150,
      art_direction: {
        style: "mechanism_3d",
        lighting: "dramatic_rim",
        material: "brushed_aluminum",
        accent_color: "#34D399",
        element_budget: 4,
      },
      visual_world: {
        environment: "dark_architectural_stage",
        primary_object: "layered_architecture",
        secondary_objects: [
          "graph_topology_slab",
          "vector_index_slab",
          "sqlite_ledger_slab",
        ],
      },
      visual_choreography: [
        {
          beat: "Z轴分层拆解",
          phrase_anchor: "提纯后的记忆实体写入三层异构存储",
          action: "explode_layers",
          target: "layered_architecture",
          description: "三层精密模组沿 Z 轴平稳分离展示内部光路",
          camera: "isometric_tilt",
          shot_scale: "wide",
          yielding: [
            { target: "background_grid", opacity: 0.18 },
          ],
          payload: {
            explode_distance: 38,
          },
        },
        {
          beat: "单层聚焦扫描",
          phrase_anchor: "底层记流水账",
          action: "scan_layer",
          target: "sqlite_ledger_slab",
          description: "聚焦扫描底层账本模组，其余层退后虚化让位",
          camera: "track_vertical",
          shot_scale: "medium",
          yielding: [
            { target: "graph_topology_slab", opacity: 0.28, scale: 0.93, zOffset: -42, blur: 2.0 },
            { target: "vector_index_slab", opacity: 0.3, scale: 0.94, zOffset: -36, blur: 1.5 },
          ],
          payload: {
            focus_layer: 2,
          },
        },
        {
          beat: "精密回弹合体",
          phrase_anchor: "顶层构建关系图谱并完成合体",
          action: "assemble",
          target: "layered_architecture",
          description: "三层存储模组回弹咬合，右侧三维晶体完全成型",
          camera: "close_up",
          shot_scale: "close_up",
          yielding: [
            { target: "background_grid", opacity: 0.15 },
          ],
        },
      ],
      text_overlays: [
        {
          text: "三层异构存储协同",
          role: "annotation",
        },
      ],
    },
    {
      id: "scene_03",
      renderer_id: "product_interface_v1",
      chapter: "真实代码接入",
      title: "三行真实代码接入记忆引擎",
      narration: "在实际工程中，只需初始化 Memory 实例，并调用 add 与 search 接口即可完成接入。",
      visual_intent: "通过真实源码与终端输出展示极简接入过程",
      durationInFrames: 150,
      art_direction: {
        style: "product_demo",
        lighting: "soft_studio",
        material: "authentic_screen",
        accent_color: "#78A9FF",
        element_budget: 2,
      },
      visual_world: {
        environment: "authentic_developer_workspace",
        primary_object: "authentic_code_viewport",
        secondary_objects: ["authentic_terminal_bench"],
        authentic_assets: {
          filename: "app/memory_service.py",
          language: "python",
          code_snippet:
            "from mem0 import Memory\n\nm = Memory()\nm.add(\"对花生严重过敏，现居上海\", user_id=\"u_01\")\nhits = m.search(\"晚餐推荐\", user_id=\"u_01\")",
          highlight_lines: [4, 5],
          terminal_commands: ["pip install mem0ai", "python app/memory_service.py"],
          terminal_output: ["✓ Distilled 2 atomic facts in 140ms", "✓ Token cost reduced by 91%"],
          metrics: [
            { value: "91%", label: "Token 消耗降低" },
            { value: "0.14s", label: "P95 检索延迟" },
          ],
        },
      },
      visual_choreography: [
        {
          beat: "展开真实代码视口",
          phrase_anchor: "只需初始化 Memory 实例",
          action: "reveal_ui",
          target: "authentic_code_viewport",
          description: "呈现项目真实初始化与调用代码",
          camera: "steady_hold",
          shot_scale: "medium",
          yielding: [
            { target: "authentic_terminal_bench", opacity: 0.35, scale: 0.95, zOffset: -30, blur: 1.5 },
          ],
        },
        {
          beat: "聚焦核心调用行",
          phrase_anchor: "并调用 add 与 search 接口即可完成接入",
          action: "highlight_code",
          target: "authentic_code_viewport",
          description: "高亮 add 与 search 核心逻辑行，其余行自动暗化让位",
          camera: "slow_dolly_in",
          shot_scale: "close_up",
          yielding: [
            { target: "authentic_terminal_bench", opacity: 0.45, scale: 0.96, zOffset: -20, blur: 1.0 },
          ],
          payload: { lines: [4, 5] },
        },
      ],
      text_overlays: [
        {
          text: "真实 SDK 极简接入",
          role: "annotation",
        },
      ],
    },
  ],
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TutorialVideo"
        component={TutorialVideo}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const totalFrames = (props.scenes || []).reduce(
            (acc, s) => acc + (s.durationInFrames || 120),
            0
          );
          return {
            durationInFrames: Math.max(1, totalFrames),
            props,
          };
        }}
      />

      {/* 代表性样板镜头审核 (Hero Shot / First Shot Approval) */}
      <Composition
        id="FirstShotVideo"
        component={TutorialVideo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const scenes = props.scenes || [];
          const heroId = (props as any).heroSceneId;
          const heroScene =
            (heroId && scenes.find((s) => s.id === heroId)) || scenes[0];
          const dur = heroScene?.durationInFrames || 150;
          return {
            durationInFrames: Math.max(1, dur),
            props: {
              ...props,
              scenes: heroScene ? [heroScene] : [],
            },
          };
        }}
      />

      {/* 30 秒先导样片（Pilot Checkpoint Preview） */}
      <Composition
        id="PilotVideo"
        component={TutorialVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={({ props }) => {
          const scenes = props.scenes || [];
          let pilotFrames = 0;
          const pilotScenes = [];
          for (const s of scenes) {
            const dur = s.durationInFrames || 120;
            if (pilotScenes.length >= 1 && pilotFrames + dur > 960) {
              break;
            }
            pilotScenes.push(s);
            pilotFrames += dur;
            if (pilotScenes.length >= 3) break;
          }
          return {
            durationInFrames: Math.max(1, pilotFrames),
            props: {
              ...props,
              scenes: pilotScenes.length > 0 ? pilotScenes : scenes.slice(0, 2),
            },
          };
        }}
      />
    </>
  );
};
