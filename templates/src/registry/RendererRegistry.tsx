import React from "react";
import { Easing, interpolate } from "remotion";
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
import registryManifest from "./registry_manifest.json";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface YieldingDirective {
  dim_opacity?: number;
  blur_px?: number;
  push_back_z?: number;
  scale?: number;
  yield_targets?: string[];
}

export interface ChoreographyBeat {
  beat: string;
  phrase_anchor: string;
  action: string;
  target: string;
  description: string;
  camera?: string;
  shot_scale?: "wide" | "medium" | "close_up" | "macro" | string;
  yielding?: string | YieldingDirective;
  payload?: Record<string, any>;
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
}

export interface SceneRenderer {
  id: string;
  name: string;
  category:
    | "PhysicalSimulation"
    | "MechanicalStructure"
    | "DataFlow"
    | "ProductInterface"
    | "SystemArchitecture"
    | "KineticTypography";
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

export function normalizeObjectLabel(
  obj: string | { id?: string; type: string; label?: string } | undefined,
  labelsMap?: Record<string, string>
): string {
  const id = normalizeObjectId(obj);
  if (typeof obj === "object" && obj.label) return obj.label;
  if (labelsMap && labelsMap[id]) return labelsMap[id];
  const builtin: Record<string, string> = {
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
    physical_balance_stage: "空间负载与精度对比台",
    authentic_code_viewport: "核心源码实现视口",
    authentic_terminal_bench: "CLI 实机运行工作台",
    authentic_ui_showcase: "产品交互界面实测",
    editorial_thesis_monolith: "核心技术命题碑",
  };
  return builtin[id] || id.replace(/_/g, " ");
}

export function isTargetMatched(candidateId: string, beatTarget: string): boolean {
  if (!candidateId || !beatTarget) return false;
  const a = candidateId.toLowerCase();
  const b = beatTarget.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * 通用镜头让位执行器 (Universal Yielding Engine)：
 * 真正读取并解析 beat.yielding（支持结构化对象或自然语言导演指令），
 * 驱动非焦点物体的 opacity、filter(blur)、translateZ 与 scale！
 */
export function createYieldStyleResolver(
  activeBeat: ChoreographyBeat,
  beatProgress: number,
  labelsMap?: Record<string, string>
) {
  return (objectId: string, objectLabel?: string): React.CSSProperties => {
    const label = objectLabel || normalizeObjectLabel(objectId, labelsMap);
    const isFocalTarget =
      isTargetMatched(objectId, activeBeat.target) ||
      isTargetMatched(label, activeBeat.target);

    if (isFocalTarget) {
      return {
        opacity: 1,
        filter: "blur(0px)",
        transform: `translateZ(${interpolate(beatProgress, [0, 0.4], [0, 28], clamp)}px) scale(${interpolate(
          beatProgress,
          [0, 0.4],
          [1, 1.04],
          clamp
        )})`,
      };
    }

    const yieldingSpec = activeBeat.yielding;
    let dimOpacity = 0.36;
    let blurPx = 1.5;
    let pushBackZ = -36;
    let yieldScale = 0.94;

    if (typeof yieldingSpec === "object" && yieldingSpec !== null) {
      if (typeof yieldingSpec.dim_opacity === "number") dimOpacity = yieldingSpec.dim_opacity;
      if (typeof yieldingSpec.blur_px === "number") blurPx = yieldingSpec.blur_px;
      if (typeof yieldingSpec.push_back_z === "number") pushBackZ = yieldingSpec.push_back_z;
      if (typeof yieldingSpec.scale === "number") yieldScale = yieldingSpec.scale;
    } else if (typeof yieldingSpec === "string" && yieldingSpec.trim()) {
      const text = yieldingSpec.toLowerCase();
      const mentionsThis =
        text.includes(objectId.toLowerCase()) ||
        (label && text.includes(label.toLowerCase())) ||
        (objectId.includes("filter") && text.includes("过滤")) ||
        (objectId.includes("waste") && (text.includes("废料") || text.includes("回收"))) ||
        (objectId.includes("particle") && text.includes("粒子")) ||
        (objectId.includes("purified") && (text.includes("提纯") || text.includes("晶体")));

      if (mentionsThis) {
        if (text.includes("虚化") || text.includes("浅景深") || text.includes("blur")) {
          blurPx = 4.0;
        }
        if (text.includes("退后") || text.includes("退入") || text.includes("背景")) {
          pushBackZ = -60;
          yieldScale = 0.9;
        }
        const pctMatch = text.match(/(\d{1,2})\s*%/);
        if (pctMatch) {
          dimOpacity = Math.max(0.12, Math.min(0.75, parseInt(pctMatch[1], 10) / 100));
        } else if (text.includes("低对比") || text.includes("压暗") || text.includes("减弱")) {
          dimOpacity = 0.26;
        }
      }
    }

    const t = interpolate(beatProgress, [0, 0.35], [0, 1], clamp);
    return {
      opacity: interpolate(t, [0, 1], [0.75, dimOpacity]),
      filter: `blur(${(blurPx * t).toFixed(1)}px)`,
      transform: `translateZ(${(pushBackZ * t).toFixed(1)}px) scale(${interpolate(
        t,
        [0, 1],
        [1, yieldScale]
      ).toFixed(3)})`,
    };
  };
}

/* ==========================================================================
   组件 1: PhysicalSimulation (3D 粒子流、碰撞分流与多面体结晶形态变化)
   融合 SVG 曲线 + ThreeHybridCanvas (MechanicalRotor3D + MorphingPolyhedron3D)
   并消费 beat.payload (particle_count, valid_ratio, flow_speed, gravity, token_labels)
   ========================================================================== */
const PhysicalSimulationRenderer: React.FC<SceneRendererProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  beats,
  beatWindows,
  activeBeatIdx,
  activeBeat,
  beatProgress,
  getYieldStyle,
}) => {
  const labels = world.object_labels || {};
  const payload = activeBeat.payload || {};

  const flowEnd = beatWindows[0]?.end || Math.floor(duration * 0.35);
  const sepEnd = beatWindows[1]?.end || Math.floor(duration * 0.68);

  const flowSpeed = typeof payload.flow_speed === "number" ? payload.flow_speed : 1.0;
  const gravityFactor = typeof payload.gravity === "number" ? payload.gravity : 1.0;
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

  const flowProgress = interpolate(f * flowSpeed, [0, flowEnd], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const sepProgress = interpolate(f, [Math.max(0, flowEnd - 8), sepEnd], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const transformProgress = interpolate(
    f,
    [Math.max(0, sepEnd - 6), duration - 8],
    [0, 1],
    { ...clamp, easing: Easing.out(Easing.cubic) }
  );

  const filterYield = getYieldStyle(
    normalizeObjectId(world.primary_object),
    normalizeObjectLabel(world.primary_object, labels)
  );
  const wasteYield = getYieldStyle("waste_container", normalizeObjectLabel("waste_container", labels));
  const purifiedYield = getYieldStyle("purified_object", normalizeObjectLabel("purified_object", labels));

  const isFilterFocal = isTargetMatched(normalizeObjectId(world.primary_object), activeBeat.target) ||
    activeBeat.action === "separate";
  const isPurifiedFocal = isTargetMatched("purified_object", activeBeat.target) ||
    activeBeat.action === "transform" ||
    activeBeat.action === "crystallize";

  const glassStyle = resolveMaterialSurface(material, theme, isFilterFocal);
  const crystalStyle = resolveMaterialSurface(material, theme, isPurifiedFocal);

  const particles = Array.from({ length: particleCount }).map((_, idx) => {
    const valid = (idx / particleCount) < validRatio || idx % 2 === 0;
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
          ...getYieldStyle("information_particles", normalizeObjectLabel("information_particles", labels)),
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

      {/* 动态粒子实体群 */}
      {particles.map((pt, idx) => {
        const stagger = idx * 0.05;
        const pFlow = interpolate(flowProgress, [stagger, Math.min(1, stagger + 0.65)], [0, 1], clamp);
        const pSep = interpolate(sepProgress, [stagger * 0.55, Math.min(1, stagger * 0.55 + 0.7)], [0, 1], clamp);
        const pTrans = interpolate(transformProgress, [0, 0.85], [0, 1], clamp);

        let x = interpolate(pFlow, [0, 1], [76 + (idx % 3) * 32, 640]);
        let y = interpolate(pFlow, [0, 1], [300 + pt.y0, 300 + pt.y0 * 0.22]);
        let scale = 1;
        let opacity = interpolate(pFlow, [0, 0.15], [0, 1], clamp);

        if (pSep > 0) {
          if (pt.valid) {
            x = interpolate(pSep, [0, 1], [640, 1020]);
            y = interpolate(pSep, [0, 1], [300 + pt.y0 * 0.22, 285 + ((idx % 3) - 1) * 26]);
          } else {
            x = interpolate(pSep, [0, 1], [640, 740 + ((idx % 3) - 1) * 40]);
            const dropEase = Math.pow(pSep, 1.8) * gravityFactor;
            y = interpolate(Math.min(1, dropEase), [0, 1], [300 + pt.y0 * 0.22, 565]);
            scale = interpolate(pSep, [0, 1], [1, 0.76]);
            opacity = interpolate(pSep, [0, 0.85, 1], [0.95, 0.7, 0.4]);
          }
        }

        if (pt.valid && pTrans > 0) {
          x = interpolate(pTrans, [0, 1], [1020, 1265]);
          y = interpolate(pTrans, [0, 1], [285 + ((idx % 3) - 1) * 26, 275]);
          scale = interpolate(pTrans, [0, 0.9, 1], [1.02, 0.45, 0]);
          opacity = interpolate(pTrans, [0, 0.75, 1], [1, 0.75, 0]);
        }

        return (
          <div
            key={pt.id}
            style={{
              position: "absolute",
              left: x - 66,
              top: y - 19,
              width: pt.valid ? 138 : 122,
              height: 38,
              opacity,
              transform: `translateZ(${pt.z0}px) scale(${scale})`,
              borderRadius: pt.valid ? 999 : 8,
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
      <div
        style={{
          position: "absolute",
          left: 520,
          top: 90,
          width: 440,
          height: 380,
          borderRadius: 28,
          ...glassStyle,
          ...filterYield,
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
            rpm={flowSpeed}
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
      <div
        style={{
          position: "absolute",
          left: 1050,
          top: 90,
          width: 450,
          height: 380,
          borderRadius: 28,
          ...crystalStyle,
          ...purifiedYield,
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
            morphProgress={interpolate(
              f,
              [Math.floor(duration * 0.35), duration - 10],
              [0.08, 1],
              clamp
            )}
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
   组件 2: MechanicalStructure (3D 多层机械结构拆解、旋转与重组)
   支持动作：explode_layers / disassemble / rotate_rotor / interlock / scan_layer / assemble
   消费 payload: explode_distance, focus_layer, rotor_rpm
   ========================================================================== */
const MechanicalStructureRenderer: React.FC<SceneRendererProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  beats,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
}) => {
  const labels = world.object_labels || {};
  const payload = activeBeat.payload || {};
  const secObjs =
    world.secondary_objects && world.secondary_objects.length > 0
      ? world.secondary_objects
      : ["graph_topology_slab", "vector_index_slab", "sqlite_ledger_slab"];

  const explodeDist = typeof payload.explode_distance === "number" ? payload.explode_distance : 34;
  const focusLayerIdx = typeof payload.focus_layer === "number" ? payload.focus_layer : -1;

  const isAssembling = activeBeat.action === "assemble" || activeBeat.action === "interlock";
  const explodeT = interpolate(f, [0, Math.min(45, duration * 0.35)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const assembleT = isAssembling
    ? interpolate(f, [duration * 0.62, duration - 10], [0, 1], {
        ...clamp,
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;
  const spreadFactor = explodeT * (1 - assembleT * 0.72);

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

          const yieldStyle = targeted
            ? { opacity: 1, filter: "blur(0px)" }
            : getYieldStyle(objId, label);
          const offsetY = (idx - (Math.min(3, secObjs.length) - 1) / 2) * explodeDist * spreadFactor;
          const surface = resolveMaterialSurface(material, theme, targeted);

          return (
            <div
              key={objId || idx}
              style={{
                position: "relative",
                height: 136,
                borderRadius: 20,
                ...surface,
                ...yieldStyle,
                transform: `${yieldStyle.transform || ""} translateY(${offsetY}px)`,
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
                        targeted && (f + cell * 6) % 20 < 10
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

      {/* 右侧：3D 机械核心与晶体耦合器 */}
      <div
        style={{
          width: 460,
          height: 460,
          borderRadius: 26,
          ...resolveMaterialSurface(material, theme, true),
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
          morphProgress={1 - spreadFactor * 0.55}
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
   组件 3: DataFlow (多路数据流、三维空间拓扑网络与探针汇聚)
   融合 SVG + SpatialTopologyNetwork3D，消费 payload: weights, confidence_target
   ========================================================================== */
const DataFlowRenderer: React.FC<SceneRendererProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  beats,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
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
    activeBeat.action === "converge_result" || activeBeatIdx === beats.length - 1;

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
      {/* 左侧：多通道探针阵列 */}
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
          ...getYieldStyle(normalizeObjectId(world.primary_object)),
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
   组件 4: SystemArchitecture (时序状态演进与空间负载对比)
   支持动作：append_state / anchor_timestamp / trace_lineage / overload_collapse / precision_extract
   ========================================================================== */
const SystemArchitectureRenderer: React.FC<SceneRendererProps> = ({
  f,
  duration,
  theme,
  material,
  world,
  beats,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
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
            opacity: isPrecisionPhase ? 0.32 : 1,
            filter: isPrecisionPhase ? "blur(2.5px)" : "none",
            transform: `scale(${isPrecisionPhase ? 0.93 : 1.02})`,
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
            opacity: isPrecisionPhase ? 1 : 0.45,
            transform: `scale(${isPrecisionPhase ? 1.05 : 0.95})`,
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
   组件 5: ProductInterface (真实代码、CLI 终端与产品 UI 交互)
   消费 payload: lines, command_index, zoom_region
   ========================================================================== */
const ProductInterfaceRenderer: React.FC<SceneRendererProps> = ({
  f,
  theme,
  world,
  activeBeatIdx,
  activeBeat,
  getYieldStyle,
}) => {
  const assets = world.authentic_assets || {};
  const payload = activeBeat.payload || {};
  const code =
    assets.code_snippet ||
    `from core.engine import Pipeline\n\npipeline = Pipeline(mode="strict_v4_1")\nresult = pipeline.run(input_stream)\nprint(result.metrics)`;
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
          border: `1.5px solid ${theme.accent}88`,
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
              {assets.filename || "src/core/pipeline.py"}
            </span>
          </div>
          <span style={{ fontSize: 12, fontFamily: MONO, color: theme.accent }}>
            AUTHENTIC SOURCE
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
   组件 6: KineticTypography (高级编辑动态排版与核心命题揭示)
   ========================================================================== */
const KineticTypographyRenderer: React.FC<SceneRendererProps> = ({
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
   Renderer Registry 核心注册表与能力匹配引擎
   ========================================================================== */
const COMPONENT_IMPLEMENTATIONS: Record<string, React.FC<SceneRendererProps>> = {
  PhysicalSimulation: PhysicalSimulationRenderer,
  MechanicalStructure: MechanicalStructureRenderer,
  DataFlow: DataFlowRenderer,
  SystemArchitecture: SystemArchitectureRenderer,
  ProductInterface: ProductInterfaceRenderer,
  KineticTypography: KineticTypographyRenderer,
};

export const SCENE_RENDERER_REGISTRY: Map<string, SceneRenderer> = new Map();

// 从共享 manifest 初始化注册表
for (const entry of registryManifest.renderers) {
  const impl = COMPONENT_IMPLEMENTATIONS[entry.id];
  if (impl) {
    SCENE_RENDERER_REGISTRY.set(entry.id, {
      id: entry.id,
      name: entry.name,
      category: entry.category as SceneRenderer["category"],
      supportedActions: entry.supportedActions,
      supportedObjects: entry.supportedObjects,
      supportedCameras: entry.supportedCameras,
      supportedEnvironments: entry.supportedEnvironments,
      render: (props) => React.createElement(impl, props),
    });
  }
}

/** 支持 Motion Designer 为特定复杂镜头注册新的自定义场景渲染器 */
export function registerCustomSceneRenderer(renderer: SceneRenderer) {
  SCENE_RENDERER_REGISTRY.set(renderer.id, renderer);
}

/**
 * 严格根据 renderer_id 或 (primary_object + actions) 匹配已注册的 SceneRenderer。
 * 绝不静默降级！若未找到匹配的能力组件，返回 null 由上层显式报错。
 */
export function resolveSceneRenderer(
  rendererId: string | undefined,
  primaryObjectId: string,
  actions: string[]
): SceneRenderer | null {
  if (rendererId && SCENE_RENDERER_REGISTRY.has(rendererId)) {
    return SCENE_RENDERER_REGISTRY.get(rendererId)!;
  }

  let bestRenderer: SceneRenderer | null = null;
  let bestScore = 0;

  for (const renderer of SCENE_RENDERER_REGISTRY.values()) {
    let score = 0;
    if (renderer.supportedObjects.includes(primaryObjectId)) {
      score += 5;
    }
    for (const act of actions) {
      if (renderer.supportedActions.includes(act)) {
        score += 3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestRenderer = renderer;
    }
  }

  return bestScore > 0 ? bestRenderer : null;
}
