import React from "react";
import { Easing, interpolate } from "remotion";
import { createMotionRegistry, createSceneMotionResolver, motionAttributes, motionStyle, commandCharacters, outputOpacity, MotionDeclaration, MotionStateResolver } from "./MotionPrimitives";
import {
  MONO,
  ResolvedTheme,
  resolveMaterialSurface,
} from "../theme";
import {
  MorphingPolyhedron3D,
  MechanicalRotor3D,
  SpatialTopologyNetwork3D,
} from "../components/ThreeHybridCanvas";
import { Editorial2DRenderer } from "../components/Editorial2DCanvas";
import registryManifest from "./registry_manifest.json";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * v4.2 结构化让位规则 (Structured Yielding Rule)：
 * 视觉导演在 beat.yielding 中声明每个非焦点目标（含 background_grid）的精确退让参数。
 */
export interface YieldingRule {
  target: string;
  opacity?: number;
  scale?: number;
  zOffset?: number;
  blur?: number;
}

export interface CameraConfig {
  speed?: "slow" | "normal" | "fast" | number;
  easing?: "cubic_in_out" | "cubic_out" | "linear" | string;
  lookAt?: string;
}

export interface ChoreographyBeat {
  beat: string;
  phrase_anchor: string;
  action: string;
  target: string;
  description: string;
  camera?: string;
  camera_config?: CameraConfig;
  shot_scale?: "wide" | "medium" | "close_up" | "macro" | string;
  yielding?: YieldingRule[];
  payload?: Record<string, any>;
  start_frame?: number;
  end_frame?: number;
  startFrame?: number;
  endFrame?: number;
}

export interface VisualWorldSpec {
  environment: string;
  primary_object: string | { id?: string; type: string; label?: string; material?: string };
  secondary_objects: Array<string | { id?: string; type: string; label?: string }>;
  object_labels?: Record<string, string>;
  authentic_assets?: {
    filename?: string;
    language?: string;
    code_snippet?: string;
    highlight_lines?: number[];
    terminal_commands?: string[];
    terminal_output?: string[];
    metrics?: Array<{ value: string; label: string }>;
    ui_title?: string;
  };
}

export interface SceneRendererProps {
  f: number;
  fps: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  beatWindows: Array<{ start: number; end: number }>;
  activeBeatIdx: number;
  activeBeat: ChoreographyBeat;
  beatProgress: number;
  getYieldStyle: (objectId: string, objectLabel?: string) => React.CSSProperties;
  getMotionState?: MotionStateResolver;
}

/* ==========================================================================
   三层可组合动画系统接口 (3-Tier Composable Animation Architecture v4.2)
   1. SceneRenderer     — 空间舞台、环境灯光与槽位布局
   2. ObjectRenderer    — 独立 3D / 2.5D 实体几何与材质规格
   3. MotionPrimitive   — 可复用的运动学动作原语 (Kinematics Evaluator)
   ========================================================================== */

export interface ObjectRendererSpec {
  id: string;
  slot: string;
  coords: [number, number, number];
  defaultLabel: string;
}

export type { MotionPrimitiveKinematics, MotionPrimitive } from "./MotionPrimitives";

export interface SceneRenderer {
  id: string;
  aliases: string[];
  component: string;
  name: string;
  category:
    | "PhysicalSimulation"
    | "MechanicalStructure"
    | "DataFlow"
    | "ProductInterface"
    | "SystemArchitecture"
    | "KineticTypography"
    | "Editorial2D";
  supportedActions: string[];
  supportedObjects: string[];
  supportedCameras: string[];
  supportedEnvironments: string[];
  render: (props: SceneRendererProps) => React.ReactNode;
}

export function normalizeObjectId(
  obj: string | { id?: string; type: string; label?: string } | undefined
): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj.id || obj.type || "";
}

const BUILTIN_OBJECT_LABELS: Record<string, string> = {
  "3d_filter_machine": "物理过滤与提纯核心",
  information_particles: "输入信息实体流",
  signal_particles: "高维特征粒子群",
  waste_container: "冗余噪音回收仓",
  purified_object: "提纯结构晶体",
  morphing_crystal: "多面体聚合晶体",
  layered_architecture: "多层异构架构模组",
  mechanical_core: "多轴机械分离核心",
  rotor_ring_assembly: "精密涡轮分离环",
  sqlite_ledger_slab: "L1 · SQLite 审计流水层",
  vector_index_slab: "L2 · 语义向量索引层",
  graph_topology_slab: "L3 · 实体关系拓扑层",
  optical_data_bus: "跨层高速光路总线",
  converged_answer_crystal: "高置信度融合输出",
  state_timeline_track: "时序状态演进导轨",
  multi_probe_router: "多通道信号路由阵列",
  spatial_topology_graph: "三维空间关系网络",
  agent_dispatcher_core: "Agent 核心调度中枢",
  skill_tool_slot: "Skill 工具执行槽位",
  api_client_origin: "客户端请求发起端",
  api_gateway_endpoint: "API 网关与鉴权端点",
  request_packets: "结构化请求报文流",
  response_payload_crystal: "流式响应载荷晶体",
  physical_balance_stage: "空间负载与精度对比台",
  authentic_code_viewport: "核心源码实现视口",
  authentic_terminal_bench: "CLI 实机运行工作台",
  authentic_ui_showcase: "产品交互界面实测",
  editorial_thesis_monolith: "核心技术命题碑",
  concept_card_2d: "核心概念白话解析卡",
  infographic_board_2d: "2D 结构化信息图板",
  flowchart_canvas_2d: "2D 正交教学流程图",
  timeline_track_2d: "2D 水平演进时间轴",
  comparison_matrix_2d: "2D 前后对比矩阵",
  code_explainer_2d: "2D 源码逐行精讲视口",
  step_board_2d: "2D 循序渐进步骤拆解板",
  cause_effect_diagram_2d: "2D 因果关系推导图",
  background_grid: "空间基准网格",
};

export function normalizeObjectLabel(
  obj: string | { id?: string; type: string; label?: string } | undefined,
  labelsMap?: Record<string, string>
): string {
  const id = normalizeObjectId(obj);
  if (typeof obj === "object" && obj.label) return obj.label;
  if (labelsMap && labelsMap[id]) return labelsMap[id];
  return BUILTIN_OBJECT_LABELS[id] || id.replace(/_/g, " ");
}

export function isTargetMatched(candidateId: string, beatTarget: string): boolean {
  if (!candidateId || !beatTarget) return false;
  return candidateId === beatTarget;
}

/* ==========================================================================
   Tier 2: ObjectRenderer Registry (含 3D 空间坐标供相机 lookAt 追踪)
   ========================================================================== */
export const OBJECT_RENDERER_REGISTRY: Map<string, ObjectRendererSpec> = new Map();

for (const [objId, spec] of Object.entries(
  (registryManifest.object_renderers || {}) as Record<string, { slot: string; coords: number[] }>
)) {
  OBJECT_RENDERER_REGISTRY.set(objId, {
    id: objId,
    slot: spec.slot,
    coords: [spec.coords[0] || 0, spec.coords[1] || 0, spec.coords[2] || 0],
    defaultLabel: BUILTIN_OBJECT_LABELS[objId] || objId,
  });
}

export function getObject3DCoords(targetId: string): [number, number, number] {
  if (!targetId) return [0, 0, 0];
  if (OBJECT_RENDERER_REGISTRY.has(targetId)) {
    return OBJECT_RENDERER_REGISTRY.get(targetId)!.coords;
  }
  for (const [id, spec] of OBJECT_RENDERER_REGISTRY.entries()) {
    if (isTargetMatched(id, targetId)) {
      return spec.coords;
    }
  }
  return [0, 0, 0];
}

/* ==========================================================================
   Tier 3: MotionPrimitive Registry (可复用动作运动学原语)
   ========================================================================== */
export const MOTION_PRIMITIVE_REGISTRY = createMotionRegistry(
  registryManifest.motion_primitives as unknown as Record<string, MotionDeclaration>
);

type StageProps = SceneRendererProps & { getMotionState: MotionStateResolver };
function motionObjectId(world: VisualWorldSpec, types: string[], fallback: string): string {
  const obj = [world.primary_object, ...world.secondary_objects].find(o => types.includes(typeof o === "string" ? o : o.type));
  return obj ? normalizeObjectId(obj) : fallback;
}

/**
 * 通用结构化镜头让位执行器 (Universal Structured Yielding Engine v4.3)：
 * 仅执行结构化数组 beat.yielding: YieldingRule[]（例如 [{"target": "background_grid", "opacity": 0.15}, {"target": "information_particles", "opacity": 0.3, "scale": 0.94, "zOffset": -40, "blur": 2}]），
 * 按精确 ID / * / non_focal 选择器驱动每个非焦点元素与背景网格的 opacity、scale、translateZ、filter(blur)。
 * 非数组的旧式字符串/对象 yielding 直接抛错（共享契约已在构建期拒绝）。
 */
export function createYieldStyleResolver(
  activeBeat: ChoreographyBeat,
  beatProgress: number,
  labelsMap?: Record<string, string>,
  visualMode?: "2d_editorial" | "3d_spatial" | "hybrid" | string
) {
  const is2D = visualMode === "2d_editorial";
  return (objectId: string, objectLabel?: string): React.CSSProperties => {
    const isBackgroundGrid = objectId === "background_grid";
    const isFocalTarget = isTargetMatched(objectId, activeBeat.target);

    const t = interpolate(beatProgress, [0, 0.35], [0, 1], clamp);
    const yieldingSpec = activeBeat.yielding;

    // 1. 优先检查结构化数组 YieldingRule[]
    if (Array.isArray(yieldingSpec)) {
      const matchedRule = yieldingSpec.find(
        (rule) =>
          rule &&
          typeof rule.target === "string" &&
          (isTargetMatched(objectId, rule.target) || rule.target === "*" ||
            (!isFocalTarget && rule.target === "non_focal"))
      );

      if (matchedRule) {
        const targetOpacity =
          typeof matchedRule.opacity === "number" ? matchedRule.opacity : isBackgroundGrid ? 0.18 : 0.32;
        const targetScale =
          typeof matchedRule.scale === "number" ? matchedRule.scale : isBackgroundGrid ? 1.0 : 0.94;
        const targetZ = is2D
          ? 0
          : typeof matchedRule.zOffset === "number"
          ? matchedRule.zOffset
          : isBackgroundGrid
          ? 0
          : -36;
        const targetBlur =
          typeof matchedRule.blur === "number" ? matchedRule.blur : isBackgroundGrid ? 0 : 1.5;

        const baseOpacity = isBackgroundGrid ? 1.0 : 0.82;
        const scaleVal = interpolate(t, [0, 1], [1, targetScale], clamp).toFixed(3);
        return {
          opacity: Number(interpolate(t, [0, 1], [baseOpacity, targetOpacity], clamp).toFixed(3)),
          filter: targetBlur > 0 ? `blur(${(targetBlur * t).toFixed(1)}px)` : "none",
          transform: is2D
            ? targetScale !== 1
              ? `scale(${scaleVal})`
              : undefined
            : targetZ !== 0 || targetScale !== 1
            ? `translateZ(${(targetZ * t).toFixed(1)}px) scale(${scaleVal})`
            : undefined,
        };
      }
    }

    if (yieldingSpec !== undefined && !Array.isArray(yieldingSpec)) {
      throw new Error("yielding must be a structured rule array");
    }
    return {};
  };
}

/* ==========================================================================
   组件 1: particle_filter_v1 / PhysicalSimulation (FilterLaboratoryStage)
   融合 SVG 曲线 + ThreeHybridCanvas (MechanicalRotor3D + MorphingPolyhedron3D)
   完全通过 getYieldStyle 与 beat.payload 驱动，零硬编码状态覆盖
   ========================================================================== */
const PhysicalSimulationRenderer: React.FC<StageProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  beatWindows,
  activeBeat,
  getYieldStyle,
  getMotionState,
}) => {
  const labels = world.object_labels || {};

  const particleGroup = motionObjectId(world, ["information_particles", "signal_particles"], "information_particles");
  const crystalId = motionObjectId(world, ["purified_object", "morphing_crystal"], "purified_object");
  const groupTargets = [{ id: normalizeObjectId(world.primary_object), actions: ["separate", "split", "merge", "collide", "hold"] }];
  const particleState = getMotionState({ objectId: particleGroup, targets: groupTargets });
  const coreState = getMotionState({ objectId: normalizeObjectId(world.primary_object) });
  const crystalState = getMotionState({ objectId: crystalId });
  const payload = particleState.payload;
  const particleCount = Math.min(
    14,
    Math.max(6, typeof payload.particle_count === "number" ? payload.particle_count : 10)
  );
  const validRatio = typeof payload.valid_ratio === "number" ? payload.valid_ratio : 0.5;
  const customTokenLabels: string[] = Array.isArray(payload.token_labels)
    ? payload.token_labels
    : [
        "核心偏好信号",
        "寒暄噪音",
        "关键约束事实",
        "重复冗余片段",
        "上下文锚点",
        "无效客套语",
        "结构化实体",
        "过时临时状态",
        "长期记忆节点",
        "格式噪声",
      ];

  const sepProgress = coreState.separation / 100;
  const transformProgress = crystalState.morph;

  const primaryObjId = normalizeObjectId(world.primary_object) || "3d_filter_machine";
  const particlesYield = getYieldStyle(
    "information_particles",
    normalizeObjectLabel("information_particles", labels)
  );
  const filterYield = getYieldStyle(
    primaryObjId,
    normalizeObjectLabel(world.primary_object, labels)
  );
  const wasteYield = getYieldStyle("waste_container", normalizeObjectLabel("waste_container", labels));
  const purifiedYield = getYieldStyle("purified_object", normalizeObjectLabel("purified_object", labels));

  const isFilterFocal =
    isTargetMatched(primaryObjId, activeBeat.target) || activeBeat.action === "separate";
  const isPurifiedFocal =
    isTargetMatched("purified_object", activeBeat.target) ||
    activeBeat.action === "transform" ||
    activeBeat.action === "crystallize";

  const glassStyle = resolveMaterialSurface(material, theme, isFilterFocal);
  const crystalStyle = resolveMaterialSurface(material, theme, isPurifiedFocal);

  const particles = Array.from({ length: particleCount }).map((_, idx) => {
    const valid = idx / particleCount < validRatio || idx % 2 === 0;
    const y0 = ((idx % 5) - 2) * 52;
    const z0 = ((idx % 3) - 1) * 20;
    return {
      id: idx,
      valid,
      y0,
      z0,
      label: customTokenLabels[idx % customTokenLabels.length],
    };
  });

  const particleGroupOpacity =
    typeof particlesYield.opacity === "number" ? particlesYield.opacity : 1;

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        transformStyle: "preserve-3d",
      }}
    >
      {/* 1. 左侧：空间粒子涌入轨道 */}
      <div
        style={{
          position: "absolute",
          left: 36,
          top: 90,
          width: 460,
          height: 440,
          ...particlesYield,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontFamily: MONO,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: theme.textMuted,
            marginBottom: 12,
          }}
        >
          01 / {normalizeObjectLabel("information_particles", labels)}
        </div>

        <svg
          width="460"
          height="380"
          viewBox="0 0 460 380"
          style={{ position: "absolute", left: 0, top: 24, overflow: "visible" }}
        >
          <path
            d="M 10 70 C 180 70, 260 175, 450 185"
            fill="none"
            stroke={theme.accent}
            strokeWidth="2"
            strokeDasharray="6 6"
            opacity={0.45}
          />
          <path
            d="M 10 190 C 190 190, 280 190, 450 190"
            fill="none"
            stroke={theme.accent}
            strokeWidth="2.5"
            opacity={0.68}
          />
          <path
            d="M 10 310 C 180 310, 260 205, 450 195"
            fill="none"
            stroke={theme.textMuted}
            strokeWidth="1.5"
            strokeDasharray="4 6"
            opacity={0.35}
          />
        </svg>
      </div>

      {/* 动态粒子实体群（受粒子流让位规则与物理参数双重驱动） */}
      {particles.map((pt, idx) => {
        const motionId = `${particleGroup}:particle:${idx}`;
        const state = getMotionState({ objectId: motionId, targets: [particleGroup, ...groupTargets], role: "particle", index: idx, count: particleCount,
          origin: [76 + (idx % 3) * 32, 300 + pt.y0, pt.z0], mergePoint: [1020, 285, 0] });
        const [x, y, z] = state.position;
        const scale = state.scale;
        const opacity = state.opacity * state.reveal * particleGroupOpacity;

        return (
          <div
            key={pt.id}
            {...motionAttributes(motionId, state)}
            style={{
              position: "absolute",
              left: x - 66,
              top: y - 19,
              width: pt.valid ? 138 : 122,
              height: 38,
              opacity,
              transform: `translateZ(${z}px) rotateZ(${state.rotateZ}deg) scale(${scale})`,
              borderRadius: state.morph * 40 + (pt.valid ? 20 : 8),
              background: pt.valid
                ? `${theme.accent}22`
                : theme.isLight
                ? "rgba(107, 114, 128, 0.14)"
                : "rgba(51, 65, 85, 0.52)",
              border: pt.valid
                ? `1.5px solid ${theme.accent}`
                : `1px dashed ${theme.textMuted}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 10px",
              fontSize: 13,
              fontWeight: pt.valid ? 700 : 500,
              color: pt.valid ? theme.textPrimary : theme.textMuted,
              zIndex: pt.valid ? 25 : 14,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: pt.valid ? "50%" : 2,
                background: pt.valid ? theme.accent : theme.textMuted,
              }}
            />
            <span style={{ whiteSpace: "nowrap" }}>{pt.label}</span>
          </div>
        );
      })}

      {/* 2. 中央：3D 物理过滤舱 + ThreeHybrid 3D 机械涡轮环 */}
      <div {...motionAttributes(primaryObjId, coreState)}
        style={{
          position: "absolute",
          left: 520,
          top: 90,
          width: 440,
          height: 380,
          borderRadius: 28,
          ...glassStyle,
          ...filterYield,
          ...motionStyle(coreState),
          padding: "22px 26px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div
              style={{
                fontSize: 12,
                fontFamily: MONO,
                color: theme.accent,
                fontWeight: 700,
                letterSpacing: 1.4,
              }}
            >
              3D ROTOR SEPARATOR // 02
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: theme.textPrimary, marginTop: 2 }}>
              {normalizeObjectLabel(world.primary_object, labels)}
            </div>
          </div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontFamily: MONO,
              fontWeight: 700,
              background: `${theme.accent}1F`,
              border: `1px solid ${theme.accent}66`,
              color: theme.accent,
            }}
          >
            {activeBeat.action.toUpperCase()}
          </div>
        </div>

        {/* 真实 3D 顶点投影机械分离涡轮环 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MechanicalRotor3D
            width={380}
            height={215}
            accentColor={theme.accent}
            separateProgress={sepProgress}
            rotation={coreState.rotateZ}
            objectId={primaryObjId}
            action={coreState.action}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            fontFamily: MONO,
            color: theme.textMuted,
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 10,
          }}
        >
          <span>MATERIAL: {material.toUpperCase()}</span>
          <span style={{ color: theme.accent }}>
            SNR +{Math.round(interpolate(sepProgress, [0, 1], [14, 97]))} dB
          </span>
        </div>
      </div>

      {/* 3. 中下方：废料回收仓 (waste_container) */}
      <div
        style={{
          position: "absolute",
          left: 590,
          top: 505,
          width: 300,
          height: 135,
          borderRadius: 18,
          background: theme.isLight
            ? "rgba(229, 231, 235, 0.78)"
            : "rgba(15, 19, 28, 0.84)",
          border: `1.5px dashed ${theme.borderStrong}`,
          ...wasteYield,
          padding: "14px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: theme.textSecondary }}>
            {normalizeObjectLabel("waste_container", labels)}
          </span>
          <span style={{ fontSize: 11, fontFamily: MONO, color: theme.textMuted }}>
            GRAVITY REJECT
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["冗余寒暄", "低信噪片段", "格式噪声"].map((tag, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                background: theme.isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)",
                color: theme.textMuted,
              }}
            >
              ✕ {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 4. 右侧：真实 3D 二十面体形态变化晶体 (MorphingPolyhedron3D) */}
      <div {...motionAttributes(crystalId, crystalState)}
        style={{
          position: "absolute",
          left: 1050,
          top: 90,
          width: 450,
          height: 380,
          borderRadius: 28,
          ...crystalStyle,
          ...purifiedYield,
          ...motionStyle(crystalState),
          padding: "22px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: 12,
              fontFamily: MONO,
              fontWeight: 700,
              color: theme.accent,
              letterSpacing: 1.4,
            }}
          >
            3D MORPHING CRYSTAL // 03
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: MONO,
              padding: "3px 10px",
              borderRadius: 999,
              background: `${theme.accent}24`,
              color: theme.accent,
              fontWeight: 700,
            }}
          >
            PURITY {Math.round(interpolate(transformProgress, [0, 1], [62, 99.6]))}%
          </span>
        </div>

        {/* 真实 3D 多面体从离散碎片 -> 完整几何晶体连续形变 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MorphingPolyhedron3D
            width={280}
            height={230}
            morphProgress={crystalState.morph}
            rotation={crystalState.rotateZ}
            shape={crystalState.shape}
            objectId={crystalId}
            action={crystalState.action}
            accentColor={theme.accent}
            isLight={theme.isLight}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 10,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 800, color: theme.textPrimary }}>
            {normalizeObjectLabel("purified_object", labels)}
          </span>
          <span style={{ fontSize: 12, fontFamily: MONO, color: theme.accent }}>
            ICOSAHEDRON MESH
          </span>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   组件 2: architecture_v1 / MechanicalStructure (LayeredArchitectureStage)
   支持动作：explode_layers / disassemble / rotate_rotor / interlock / scan_layer / connect_bus / assemble
   ========================================================================== */
const MechanicalStructureRenderer: React.FC<StageProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  activeBeat,
  getYieldStyle,
  getMotionState,
}) => {
  const labels = world.object_labels || {};
  const payload = activeBeat.payload || {};
  const secObjs =
    world.secondary_objects && world.secondary_objects.length > 0
      ? world.secondary_objects
      : ["graph_topology_slab", "vector_index_slab", "sqlite_ledger_slab"];

  const explodeDist = typeof payload.explode_distance === "number" ? payload.explode_distance : 34;
  const focusLayerIdx = typeof payload.focus_layer === "number" ? payload.focus_layer : -1;

  const coreState = getMotionState({ objectId: normalizeObjectId(world.primary_object) });
  const spreadFactor = coreState.separation / Math.max(1, explodeDist);
  const busState = getMotionState({ objectId: "optical_data_bus", targets: [{ id: normalizeObjectId(world.primary_object), actions: ["connect_bus", "hold"] }] });

  const primaryId = normalizeObjectId(world.primary_object) || "layered_architecture";
  const coreYield = getYieldStyle(primaryId, normalizeObjectLabel(world.primary_object, labels));

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 40px",
        transformStyle: "preserve-3d",
      }}
    >
      {/* 左侧：多层机械/存储模组拆解台 */}
      <div
        style={{
          width: 960,
          height: 560,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 22,
        }}
      >
        {secObjs.slice(0, 3).map((layerObj, idx) => {
          const objId = normalizeObjectId(layerObj);
          const label = normalizeObjectLabel(layerObj, labels);
          const targeted =
            focusLayerIdx === idx ||
            isTargetMatched(objId, activeBeat.target) ||
            activeBeat.action === "explode_layers" ||
            activeBeat.action === "assemble";

          const yieldStyle = getYieldStyle(objId, label);
          const state = getMotionState({ objectId: objId, targets: [primaryId], role: "layer", index: idx, count: Math.min(3, secObjs.length), origin: [0, 0, 0], assembled: [0, 0, 0] });
          const surface = resolveMaterialSurface(material, theme, targeted);

          return (
            <div
              key={objId || idx}
              {...motionAttributes(objId, state)}
              style={{
                position: "relative",
                height: 136,
                borderRadius: 20,
                ...surface,
                ...yieldStyle,
                transform: `${yieldStyle.transform || ""} ${motionStyle(state).transform}`,
                padding: "20px 30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                zIndex: 30 - idx,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: `${theme.accent}20`,
                    border: `1.5px solid ${theme.accent}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: MONO,
                    fontWeight: 800,
                    fontSize: 18,
                    color: theme.accent,
                  }}
                >
                  L{Math.min(3, secObjs.length) - idx}
                </div>
                <div>
                  <div style={{ fontSize: 23, fontWeight: 800, color: theme.textPrimary }}>
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: MONO,
                      color: theme.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    MODULE: {objId} · {targeted ? "ENGAGED" : "YIELDED"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {[0, 1, 2, 3].map((cell) => (
                  <div
                    key={cell}
                    style={{
                      width: 42,
                      height: 52,
                      borderRadius: 8,
                      border: `1px solid ${targeted ? theme.accent : theme.borderStrong}`,
                      background:
                        state.scan > cell / 4
                          ? `${theme.accent}33`
                          : "rgba(255,255,255,0.03)",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <svg width={1560} height={680} style={{ position: "absolute", pointerEvents: "none" }}>
        <path {...motionAttributes("optical_data_bus", busState)} d="M930 170 L990 170 L990 520 L930 520 M990 340 L1100 340" pathLength={1} fill="none" stroke={theme.accent} strokeWidth={4} strokeDasharray={1} strokeDashoffset={1 - busState.connection}/>
      </svg>
      {/* 右侧：3D 机械核心与晶体耦合器 */}
      <div {...motionAttributes(primaryId, coreState)}
        style={{
          width: 460,
          height: 460,
          borderRadius: 26,
          ...resolveMaterialSurface(material, theme, true),
          ...coreYield,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            fontFamily: MONO,
            color: theme.accent,
            fontWeight: 700,
          }}
        >
          <span>3D ASSEMBLY CORE</span>
          <span>Z-SPREAD {(spreadFactor * explodeDist).toFixed(0)}MM</span>
        </div>

        <MorphingPolyhedron3D
          width={300}
          height={250}
          morphProgress={1 - Math.min(1, coreState.separation / 160)}
          rotation={coreState.rotateZ}
          objectId={primaryId}
          action={coreState.action}
          accentColor={theme.accent}
          isLight={theme.isLight}
        />

        <div style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary }}>
          {normalizeObjectLabel(world.primary_object, labels)}
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   组件 3: dataflow_router_v1 / DataFlow (MultiProbeRouterStage)
   支持多路探针路由、Agent Skill 调度 (dispatch_tool) 与 API 全生命周期 (send_request / stream_response)
   ========================================================================== */
const DataFlowRenderer: React.FC<StageProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  beats,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
  getMotionState,
}) => {
  const labels = world.object_labels || {};
  const payload = activeBeat.payload || {};
  const probes =
    world.secondary_objects && world.secondary_objects.length > 0
      ? world.secondary_objects
      : ["vector_probe", "lexical_probe", "graph_probe"];

  const customWeights: number[] = Array.isArray(payload.weights)
    ? payload.weights
    : [94, 89, 96, 98];
  const confTarget = typeof payload.confidence_target === "number" ? payload.confidence_target : 98.6;
  const convergeT = interpolate(f, [duration * 0.4, duration - 10], [0, 1], clamp);
  const isConverging =
    activeBeat.action === "converge_result" ||
    activeBeat.action === "stream_response" ||
    activeBeatIdx === beats.length - 1;

  const primaryId = normalizeObjectId(world.primary_object) || "multi_probe_router";

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 42px",
      }}
    >
      {/* 左侧：多通道探针 / Skill 槽位 / API 链路节点阵列 */}
      <div
        style={{
          width: 680,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {probes.slice(0, 3).map((pr, idx) => {
          const id = normalizeObjectId(pr);
          const label = normalizeObjectLabel(pr, labels);
          const wScore = Math.round(
            interpolate(f, [idx * 8, idx * 8 + 40], [0, customWeights[idx % customWeights.length]], clamp)
          );
          const yieldStyle = getYieldStyle(id, label);
          const surface = resolveMaterialSurface(material, theme, !isConverging);

          return (
            <div
              key={id || idx}
              style={{
                borderRadius: 16,
                ...surface,
                ...yieldStyle,
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 13,
                    fontWeight: 800,
                    color: theme.accent,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: `${theme.accent}1F`,
                  }}
                >
                  CH 0{idx + 1}
                </span>
                <span style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary }}>
                  {label}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, width: 220 }}>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: theme.border,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${wScore}%`,
                      height: "100%",
                      background: theme.accent,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 16,
                    fontWeight: 800,
                    color: theme.accent,
                    width: 46,
                    textAlign: "right",
                  }}
                >
                  {wScore}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 右侧：真实 3D 空间拓扑网络与汇聚棱镜 (SpatialTopologyNetwork3D) */}
      <div
        style={{
          width: 680,
          height: 460,
          borderRadius: 28,
          ...resolveMaterialSurface(material, theme, true),
          ...getYieldStyle(primaryId, normalizeObjectLabel(world.primary_object, labels)),
          padding: "24px 30px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontFamily: MONO,
            color: theme.accent,
            fontWeight: 700,
          }}
        >
          <span>3D SPATIAL TOPOLOGY & ROUTER</span>
          <span>CONFIDENCE {interpolate(convergeT, [0, 1], [72, confTarget]).toFixed(1)}%</span>
        </div>

        <SpatialTopologyNetwork3D
          width={560}
          height={320}
          accentColor={theme.accent}
          convergeProgress={convergeT}
        />

        <div style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary }}>
          {normalizeObjectLabel(world.primary_object, labels)}
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   组件 4: timeline_state_v1 / SystemArchitecture (StateTimelineStage)
   支持动作：append_state / anchor_timestamp / trace_lineage / overload_collapse / precision_extract
   ========================================================================== */
const SystemArchitectureRenderer: React.FC<StageProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
  getMotionState,
}) => {
  const labels = world.object_labels || {};
  const payload = activeBeat.payload || {};
  const primaryId = normalizeObjectId(world.primary_object).toLowerCase();
  const isBalance =
    primaryId.includes("balance") ||
    activeBeat.action === "overload_collapse" ||
    activeBeat.action === "precision_extract";

  if (isBalance) {
    const isPrecisionPhase =
      activeBeatIdx > 0 || activeBeat.action === "precision_extract";
    const overloadTokens = payload.overload_tokens || "26,000 TOKENS";
    const precisionTokens = payload.precision_tokens || "3 NODES / 0.14s";

    const overloadYield = getYieldStyle("unfiltered_monolith");
    const precisionYield = getYieldStyle("precision_extraction_core");

    return (
      <div
        style={{
          position: "relative",
          width: 1560,
          height: 680,
          display: "flex",
          gap: 38,
          alignItems: "center",
          padding: "0 36px",
        }}
      >
        <div
          style={{
            flex: 1,
            height: 460,
            borderRadius: 24,
            ...resolveMaterialSurface(material, theme, !isPrecisionPhase),
            ...overloadYield,
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontFamily: MONO, color: theme.textMuted, fontWeight: 700 }}>
              UNFILTERED MONOLITH
            </span>
            <span style={{ fontSize: 13, fontFamily: MONO, color: "#F43F5E", fontWeight: 700 }}>
              {overloadTokens}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((blk) => (
              <div
                key={blk}
                style={{
                  height: 44,
                  borderRadius: 8,
                  background:
                    blk === 2
                      ? "rgba(244, 63, 94, 0.22)"
                      : theme.isLight
                      ? "rgba(17,19,24,0.06)"
                      : "rgba(255,255,255,0.05)",
                  border: `1px solid ${blk === 2 ? "#F43F5E" : theme.borderStrong}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 16px",
                  fontSize: 14,
                  fontFamily: MONO,
                  color: blk === 2 ? "#F43F5E" : theme.textMuted,
                }}
              >
                <span>
                  {blk === 2 ? "CRITICAL SIGNAL (BURIED)" : `REDUNDANT CONTEXT #0${blk + 1}`}
                </span>
                <span>OVERLOAD</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, color: theme.textSecondary }}>
            全量上下文堆叠导致关键约束被淹没
          </div>
        </div>

        <div
          style={{
            flex: 1.15,
            height: 460,
            borderRadius: 24,
            ...resolveMaterialSurface(material, theme, isPrecisionPhase),
            ...precisionYield,
            padding: "28px 34px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontFamily: MONO, color: theme.accent, fontWeight: 700 }}>
              PRECISION EXTRACTION
            </span>
            <span style={{ fontSize: 13, fontFamily: MONO, color: theme.accent, fontWeight: 700 }}>
              {precisionTokens}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(world.secondary_objects || ["indexed_fact_01", "indexed_fact_02", "indexed_fact_03"])
              .slice(0, 3)
              .map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    height: 76,
                    borderRadius: 14,
                    background: `${theme.accent}16`,
                    border: `1.5px solid ${theme.accent}`,
                    padding: "0 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 800, color: theme.textPrimary }}>
                    {normalizeObjectLabel(item, labels)}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: MONO, color: theme.accent, fontWeight: 700 }}>
                    ACTIVE
                  </span>
                </div>
              ))}
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent }}>
            按需检索目标实体，冗余负载零注入
          </div>
        </div>
      </div>
    );
  }

  const nodes =
    world.secondary_objects && world.secondary_objects.length > 0
      ? world.secondary_objects
      : ["historical_state_v1", "incremental_state_v2", "timestamped_latest_state"];
  const progress = interpolate(f, [0, duration * 0.8], [0, 1], clamp);

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 360,
          height: 3,
          background: `linear-gradient(90deg, ${theme.borderStrong}, ${theme.accent}, ${theme.borderStrong})`,
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 36,
          width: 1400,
          justifyContent: "space-between",
          zIndex: 20,
        }}
      >
        {nodes.slice(0, 3).map((node, idx) => {
          const id = normalizeObjectId(node);
          const label = normalizeObjectLabel(node, labels);
          const isLatest = idx === Math.min(2, nodes.length - 1);
          const yieldStyle = getYieldStyle(id, label);
          const surface = resolveMaterialSurface(
            material,
            theme,
            isTargetMatched(id, activeBeat.target) || isLatest
          );
          const appear = interpolate(progress, [idx * 0.22, idx * 0.22 + 0.35], [0, 1], clamp);

          return (
            <div
              key={id || idx}
              style={{
                flex: 1,
                borderRadius: 22,
                ...surface,
                ...yieldStyle,
                padding: "24px 26px",
                opacity: appear * (typeof yieldStyle.opacity === "number" ? yieldStyle.opacity : 1),
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 290,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 700, color: theme.accent }}>
                  STATE // T+{idx + 1}
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: MONO,
                    background: isLatest ? `${theme.accent}26` : "rgba(255,255,255,0.06)",
                    color: isLatest ? theme.accent : theme.textSecondary,
                    fontWeight: 700,
                  }}
                >
                  {isLatest ? "ACTIVE ANCHOR" : "IMMUTABLE LOG"}
                </span>
              </div>

              <div style={{ fontSize: 23, fontWeight: 800, color: theme.textPrimary, margin: "18px 0" }}>
                {label}
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: theme.textSecondary,
                  borderTop: `1px solid ${theme.border}`,
                  paddingTop: 12,
                  fontFamily: MONO,
                }}
              >
                {isLatest ? "✓ APPEND-ONLY VERIFIED" : "↺ ARCHIVED LINEAGE"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ==========================================================================
   组件 5: product_interface_v1 / ProductInterface (AuthenticProductDemoStage)
   真实代码、CLI 终端与产品 UI 交互，严格校验 authentic_assets，绝不将兜底代码冒充为 AUTHENTIC SOURCE
   ========================================================================== */
const ProductInterfaceRenderer: React.FC<StageProps> = ({
  f,
  theme,
  world,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
  getMotionState,
}) => {
  const assets = world.authentic_assets || {};
  const payload = activeBeat.payload || {};
  const hasAuthenticCode = Boolean(assets.code_snippet && assets.code_snippet.trim().length > 0);
  const code = hasAuthenticCode
    ? assets.code_snippet!
    : `# [SCHEMATIC PREVIEW - MISSING authentic_assets.code_snippet]\n# Please populate visual_world.authentic_assets from repository source`;
  const codeLines = code.split("\n");
  const commands = assets.terminal_commands || [];
  const metrics = assets.metrics || [];

  const highlightLines: number[] =
    payload.lines ||
    assets.highlight_lines ||
    (activeBeatIdx > 0 ? [3, 4, 5] : []);

  const codeYield = getYieldStyle("authentic_code_viewport");
  const termYield = getYieldStyle("authentic_terminal_bench");

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        gap: 32,
        alignItems: "stretch",
        padding: "20px 30px",
      }}
    >
      <div
        style={{
          flex: commands.length > 0 ? 1.35 : 1.7,
          borderRadius: 20,
          background: "#0D1117",
          border: `1.5px solid ${hasAuthenticCode ? `${theme.accent}88` : "#F59E0B"}`,
          boxShadow: "0 28px 64px rgba(0,0,0,0.68)",
          ...codeYield,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 46,
            background: "#161B22",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#F43F5E" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#F59E0B" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#34D399" }} />
            <span
              style={{
                marginLeft: 12,
                fontSize: 14,
                fontFamily: MONO,
                color: "#E6EDF3",
                fontWeight: 700,
              }}
            >
              {assets.filename || "UNSPECIFIED_FILE"}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontFamily: MONO,
              color: hasAuthenticCode ? theme.accent : "#F59E0B",
              fontWeight: 700,
            }}
          >
            {hasAuthenticCode ? "AUTHENTIC SOURCE // VERIFIED" : "SCHEMATIC PREVIEW // UNVERIFIED"}
          </span>
        </div>

        <div
          style={{
            padding: "22px 26px",
            fontFamily: MONO,
            fontSize: 20,
            lineHeight: 1.65,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {codeLines.slice(0, 14).map((line, i) => {
            const lineNum = i + 1;
            const hasFocusFilter = highlightLines.length > 0;
            const isHighlighted = !hasFocusFilter || highlightLines.includes(lineNum);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "3px 12px",
                  borderRadius: 6,
                  background:
                    hasFocusFilter && isHighlighted ? `${theme.accent}1C` : "transparent",
                  borderLeft:
                    hasFocusFilter && isHighlighted
                      ? `3px solid ${theme.accent}`
                      : "3px solid transparent",
                  opacity: isHighlighted ? 1 : 0.28,
                }}
              >
                <span style={{ width: 38, color: "#6E7681", fontSize: 15 }}>
                  {String(lineNum).padStart(2, "0")}
                </span>
                <span style={{ color: "#E6EDF3", whiteSpace: "pre" }}>{line}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(commands.length > 0 || metrics.length > 0) && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, ...termYield }}>
          {commands.length > 0 && (
            <div
              style={{
                flex: 1.2,
                borderRadius: 20,
                background: "#090D14",
                border: "1px solid rgba(255,255,255,0.16)",
                padding: "20px 24px",
                fontFamily: MONO,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: theme.accent, fontWeight: 700 }}>
                TERMINAL EXECUTION
              </div>
              {commands.map((cmd, ci) => {
                const chars = Math.floor(
                  interpolate(f, [ci * 22, ci * 22 + 32], [0, cmd.length], clamp)
                );
                return (
                  <div key={ci} style={{ fontSize: 18, color: "#E2E8F0" }}>
                    <span style={{ color: "#34D399", marginRight: 10 }}>$</span>
                    <span>{cmd.slice(0, chars)}</span>
                  </div>
                );
              })}
              {assets.terminal_output &&
                assets.terminal_output.map((outLine, oi) => (
                  <div
                    key={oi}
                    style={{
                      fontSize: 16,
                      color: "#94A3B8",
                      opacity: interpolate(f, [36 + oi * 10, 48 + oi * 10], [0, 1], clamp),
                    }}
                  >
                    {outLine}
                  </div>
                ))}
            </div>
          )}

          {metrics.length > 0 && (
            <div style={{ display: "flex", gap: 18 }}>
              {metrics.slice(0, 3).map((m, mi) => (
                <div
                  key={mi}
                  style={{
                    flex: 1,
                    borderRadius: 18,
                    background: theme.surfaceElevated,
                    border: `1.5px solid ${theme.accent}66`,
                    padding: "18px 20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      color: theme.accent,
                      fontFamily: MONO,
                    }}
                  >
                    {m.value}
                  </div>
                  <div style={{ fontSize: 15, color: theme.textSecondary, marginTop: 4 }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   组件 6: kinetic_thesis_v1 / KineticTypography (KineticTypographyStage)
   ========================================================================== */
const KineticTypographyRenderer: React.FC<StageProps> = ({
  theme,
  material,
  world,
  activeBeat,
  beatProgress,
}) => {
  const payload = activeBeat.payload || {};
  const labels = world.object_labels || {};
  const headline =
    payload.headline || normalizeObjectLabel(world.primary_object, labels);
  const subheadline = payload.subheadline || "";
  const metricValue = payload.metric_value || "";

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 1160,
          borderRadius: 28,
          ...resolveMaterialSurface(material, theme, true),
          padding: "56px 68px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          transform: `scale(${interpolate(beatProgress, [0, 1], [0.96, 1.02], clamp)})`,
        }}
      >
        <div style={{ fontSize: 14, fontFamily: MONO, color: theme.accent, fontWeight: 700 }}>
          EDITORIAL THESIS // AXIOM
        </div>
        <div
          style={{
            fontSize: 54,
            fontWeight: 900,
            color: theme.textPrimary,
            letterSpacing: -1,
            lineHeight: 1.2,
          }}
        >
          {headline}
        </div>
        {subheadline && (
          <div style={{ fontSize: 24, color: theme.textSecondary, fontWeight: 500 }}>
            {subheadline}
          </div>
        )}
        {metricValue && (
          <div
            style={{
              fontSize: 64,
              fontFamily: MONO,
              fontWeight: 900,
              color: theme.accent,
              marginTop: 8,
            }}
          >
            {metricValue}
          </div>
        )}
      </div>
    </div>
  );
};

/* ==========================================================================
   Tier 1: SceneRenderer Registry 核心注册表与严格 renderer_id 路由引擎
   ========================================================================== */
const COMPONENT_IMPLEMENTATIONS: Record<string, React.FC<StageProps>> = {
  particle_filter_v1: PhysicalSimulationRenderer,
  PhysicalSimulation: PhysicalSimulationRenderer,
  FilterLaboratoryStage: PhysicalSimulationRenderer,
  architecture_v1: MechanicalStructureRenderer,
  MechanicalStructure: MechanicalStructureRenderer,
  LayeredArchitectureStage: MechanicalStructureRenderer,
  dataflow_router_v1: DataFlowRenderer,
  DataFlow: DataFlowRenderer,
  MultiProbeRouterStage: DataFlowRenderer,
  timeline_state_v1: SystemArchitectureRenderer,
  SystemArchitecture: SystemArchitectureRenderer,
  StateTimelineStage: SystemArchitectureRenderer,
  product_interface_v1: ProductInterfaceRenderer,
  ProductInterface: ProductInterfaceRenderer,
  AuthenticProductDemoStage: ProductInterfaceRenderer,
  kinetic_thesis_v1: KineticTypographyRenderer,
  KineticTypography: KineticTypographyRenderer,
  KineticTypographyStage: KineticTypographyRenderer,
  editorial_2d_v1: Editorial2DRenderer,
  Editorial2D: Editorial2DRenderer,
  Editorial2DRenderer: Editorial2DRenderer,
};

export const SCENE_RENDERER_REGISTRY: Map<string, SceneRenderer> = new Map();

// 从唯一数据源 renderer-registry.json / registry_manifest.json 初始化注册表（同时注册主 ID 与别名）
for (const entry of registryManifest.renderers) {
  const impl =
    COMPONENT_IMPLEMENTATIONS[entry.id] ||
    COMPONENT_IMPLEMENTATIONS[(entry as any).component] ||
    ((entry as any).aliases || []).map((a: string) => COMPONENT_IMPLEMENTATIONS[a]).find(Boolean);

  if (impl) {
    const rendererObj: SceneRenderer = {
      id: entry.id,
      aliases: (entry as any).aliases || [],
      component: (entry as any).component || entry.id,
      name: entry.name,
      category: entry.category as SceneRenderer["category"],
      supportedActions: entry.supportedActions,
      supportedObjects: entry.supportedObjects,
      supportedCameras: entry.supportedCameras,
      supportedEnvironments: entry.supportedEnvironments,
      render: (props) => React.createElement(impl, {
        ...props,
        getMotionState: props.getMotionState || createSceneMotionResolver(props, MOTION_PRIMITIVE_REGISTRY),
      }),
    };
    SCENE_RENDERER_REGISTRY.set(entry.id, rendererObj);
    for (const alias of rendererObj.aliases) {
      SCENE_RENDERER_REGISTRY.set(alias, rendererObj);
    }
    if (rendererObj.component) {
      SCENE_RENDERER_REGISTRY.set(rendererObj.component, rendererObj);
    }
  }
}

/** 支持 Motion Designer 为特定复杂镜头注册新的自定义场景渲染器 */
export function registerCustomSceneRenderer(renderer: SceneRenderer) {
  SCENE_RENDERER_REGISTRY.set(renderer.id, renderer);
  for (const alias of renderer.aliases || []) {
    SCENE_RENDERER_REGISTRY.set(alias, renderer);
  }
}

/**
 * v4.2 严格 renderer_id 路由：
 * 仅根据分镜显式声明的 renderer_id 从 SCENE_RENDERER_REGISTRY 获取对应组件。
 * 彻底移除根据 primary_object 或 actions 字符串猜测路由的启发式兜底，未注册或缺失直接返回 null 触发显式报错。
 */
export function resolveSceneRenderer(rendererId: string | undefined): SceneRenderer | null {
  if (!rendererId || !rendererId.trim()) {
    return null;
  }
  return SCENE_RENDERER_REGISTRY.get(rendererId.trim()) || null;
}
