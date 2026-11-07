import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FONT,
  MONO,
  GlobalArtDirection,
  SceneArtDirection,
  ResolvedTheme,
  resolveArtTheme,
  resolveMaterialSurface,
} from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface ChoreographyBeat {
  beat: string;
  phrase_anchor?: string;
  action: string;
  target: string;
  description: string;
  camera?: string;
  shot_scale?: "wide" | "medium" | "close_up" | "macro" | string;
  yielding?: string;
  payload?: Record<string, any>;
}

export interface BeatTiming {
  beat_index: number;
  beat: string;
  action: string;
  target: string;
  camera?: string;
  shot_scale?: string;
  start_frame: number;
  end_frame: number;
  mid_frame?: number;
}

export interface TextOverlayItem {
  text: string;
  role: "annotation" | "metric" | "caption" | "callout" | string;
  beat_index?: number;
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

export interface SceneV4Props {
  id: string;
  chapter?: string;
  title?: string;
  continuity_group?: string;
  narration: string;
  visual_intent?: string;
  art_direction?: SceneArtDirection;
  visual_world?: VisualWorldSpec;
  visual_choreography?: ChoreographyBeat[];
  text_overlays?: TextOverlayItem[];
  beat_timings?: BeatTiming[];
  durationInFrames: number;
}

/** 单调三次 Hermite 样条插值：用于跨节拍连续相机运动 */
const hermiteSpline = (xs: number[], ys: number[]) => {
  const n = xs.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => ys[0];
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / Math.max(1e-5, xs[i + 1] - x));
  const m = xs.map((_, i) =>
    i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  );
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = Math.max(1e-5, xs[i + 1] - xs[i]);
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
};

function normalizeObjectId(obj: string | { id?: string; type: string; label?: string }): string {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj.id || obj.type || "";
}

function normalizeObjectLabel(
  obj: string | { id?: string; type: string; label?: string },
  labelsMap?: Record<string, string>
): string {
  const id = normalizeObjectId(obj);
  if (typeof obj === "object" && obj.label) return obj.label;
  if (labelsMap && labelsMap[id]) return labelsMap[id];
  const builtin: Record<string, string> = {
    "3d_filter_machine": "物理过滤与提纯核心",
    information_particles: "输入信息实体流",
    waste_container: "冗余噪音回收仓",
    purified_object: "提纯结构晶体",
    layered_architecture: "多层异构架构模组",
    sqlite_ledger_slab: "L1 · SQLite 审计流水层",
    vector_index_slab: "L2 · 语义向量索引层",
    graph_topology_slab: "L3 · 实体关系拓扑层",
    optical_data_bus: "跨层高速光路总线",
    converged_answer_crystal: "高置信度融合输出",
    state_timeline_track: "时序状态演进导轨",
    multi_probe_router: "多通道信号路由阵列",
    physical_balance_stage: "空间负载与精度对比台",
    authentic_code_viewport: "核心源码实现视口",
    authentic_terminal_bench: "CLI 实机运行工作台",
    authentic_ui_showcase: "产品交互界面实测",
  };
  return builtin[id] || id.replace(/_/g, " ");
}

function isTargetMatched(candidateId: string, beatTarget: string): boolean {
  if (!candidateId || !beatTarget) return false;
  const a = candidateId.toLowerCase();
  const b = beatTarget.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

/** 根据 camera 和 shot_scale 推导单个节拍的目标相机姿态 */
function cameraPoseForBeat(
  camera: string = "steady_hold",
  shotScale: string = "medium",
  beatIndex: number = 0
) {
  let scale = 1.0;
  if (shotScale === "wide") scale = 0.92;
  else if (shotScale === "medium") scale = 1.02;
  else if (shotScale === "close_up") scale = 1.15;
  else if (shotScale === "macro") scale = 1.24;

  let rotX = 12;
  let rotY = -6;
  let rotZ = 0;
  let tx = 0;
  let ty = 0;

  switch (camera) {
    case "slow_dolly_in":
      scale *= 1.06;
      rotX = 14;
      rotY = -8;
      tx = 28;
      break;
    case "dolly_out":
      scale *= 0.92;
      rotX = 16;
      rotY = -4;
      break;
    case "close_up":
      scale = Math.max(scale, 1.16);
      rotX = 8;
      rotY = -4;
      tx = -60;
      ty = -10;
      break;
    case "macro_focus":
      scale = Math.max(scale, 1.24);
      rotX = 6;
      rotY = -2;
      tx = -80;
      break;
    case "track_horizontal":
      rotX = 11;
      rotY = beatIndex % 2 === 0 ? 5 : -5;
      tx = -16;
      break;
    case "track_vertical":
      rotX = 16;
      rotY = -6;
      ty = beatIndex === 0 ? 24 : -24;
      break;
    case "orbit_left":
      rotX = 15;
      rotY = -16;
      rotZ = -2;
      break;
    case "orbit_right":
      rotX = 15;
      rotY = 14;
      rotZ = 2;
      break;
    case "isometric_tilt":
      rotX = 24;
      rotY = -18;
      rotZ = 4;
      break;
    case "top_down_overview":
      rotX = 32;
      rotY = 0;
      scale *= 0.95;
      break;
    case "steady_hold":
    default:
      rotX = 10;
      rotY = -5;
      break;
  }

  return { scale, rotX, rotY, rotZ, tx, ty };
}

/* ==========================================================================
   物理机制渲染器 1：3D 信息过滤与提纯实验室 (3d_filter_machine)
   完整实现：
   - Beat 1 (particles_flow): 大量不同形态的信息实体沿空间曲线涌入透明过滤舱
   - Beat 2 (separate): 物理分流阀启动，无效噪音向下坠入废料回收区，有效信号继续前进
   - Beat 3 (transform): 有效信号在右侧凝聚成一个清晰、完整的发光晶体实体，相机推近特写
   ========================================================================== */
const FilterLaboratoryStage: React.FC<{
  f: number;
  fps: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  beatWindows: Array<{ start: number; end: number }>;
  activeBeatIdx: number;
}> = ({ f, fps, duration, theme, material, world, beats, beatWindows, activeBeatIdx }) => {
  const activeBeat = beats[activeBeatIdx] || beats[0];
  const labels = world.object_labels || {};

  // 计算三阶段物理进度
  const flowEnd = beatWindows[0]?.end || Math.floor(duration * 0.36);
  const sepEnd = beatWindows[1]?.end || Math.floor(duration * 0.7);

  const flowProgress = interpolate(f, [0, flowEnd], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const sepProgress = interpolate(
    f,
    [Math.max(0, flowEnd - 10), sepEnd],
    [0, 1],
    { ...clamp, easing: Easing.inOut(Easing.cubic) }
  );
  const transformProgress = interpolate(
    f,
    [Math.max(0, sepEnd - 8), duration - 8],
    [0, 1],
    { ...clamp, easing: Easing.out(Easing.cubic) }
  );

  // 镜头让位状态计算 (Yielding)
  const isFinalCloseUp =
    activeBeat?.action === "transform" ||
    isTargetMatched("purified_object", activeBeat?.target || "");
  const isSeparating = activeBeat?.action === "separate";

  const filterMachineYieldOpacity = isFinalCloseUp
    ? interpolate(transformProgress, [0, 0.7], [1, 0.38], clamp)
    : 1;
  const wasteYieldOpacity = isFinalCloseUp
    ? 0.28
    : isSeparating
    ? 1
    : 0.55;
  const purifiedFocusScale = isFinalCloseUp
    ? interpolate(transformProgress, [0, 1], [0.95, 1.14], clamp)
    : 0.88;

  // 12 个物理信息实体粒子（含有效信号与无效噪音）
  const particles = [
    { id: 0, valid: true, y0: -110, z0: 20, label: "核心偏好信号", shape: "hex" },
    { id: 1, valid: false, y0: -55, z0: -15, label: "寒暄噪音", shape: "shard" },
    { id: 2, valid: true, y0: 15, z0: 30, label: "关键约束事实", shape: "hex" },
    { id: 3, valid: false, y0: 85, z0: -20, label: "重复冗余片段", shape: "shard" },
    { id: 4, valid: true, y0: -80, z0: 10, label: "上下文锚点", shape: "hex" },
    { id: 5, valid: false, y0: 45, z0: -10, label: "无效客套语", shape: "shard" },
    { id: 6, valid: true, y0: -20, z0: 25, label: "结构化实体", shape: "hex" },
    { id: 7, valid: false, y0: 115, z0: -25, label: "过时临时状态", shape: "shard" },
    { id: 8, valid: true, y0: 55, z0: 18, label: "长期记忆节点", shape: "hex" },
    { id: 9, valid: false, y0: -125, z0: -18, label: "格式噪声", shape: "shard" },
  ];

  const glassStyle = resolveMaterialSurface(material, theme, !isFinalCloseUp);
  const crystalStyle = resolveMaterialSurface(material, theme, true);

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        transformStyle: "preserve-3d",
      }}
    >
      {/* 1. 左侧：空间粒子涌入轨道与信息粒子流 (information_particles) */}
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 90,
          width: 460,
          height: 440,
          opacity: isFinalCloseUp ? 0.3 : 1,
          transform: `translateZ(${isFinalCloseUp ? -40 : 0}px)`,
        }}
      >
        <div
          style={{
            fontSize: 15,
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

        {/* 空间流线导轨 SVG */}
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
            opacity={0.65}
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

      {/* 动态粒子实体（沿空间曲线涌入 -> 过滤室分流 -> 废料下坠 / 有效信号向右侧凝聚） */}
      {particles.map((pt, idx) => {
        const stagger = idx * 0.055;
        const pFlow = interpolate(flowProgress, [stagger, Math.min(1, stagger + 0.65)], [0, 1], clamp);
        const pSep = interpolate(sepProgress, [stagger * 0.6, Math.min(1, stagger * 0.6 + 0.7)], [0, 1], clamp);
        const pTrans = interpolate(transformProgress, [0, 0.85], [0, 1], clamp);

        // 阶段 1: 从左侧 x=80 沿曲线汇聚到过滤核心入口 x=640, y=300
        let x = interpolate(pFlow, [0, 1], [80 + (idx % 3) * 35, 640]);
        let y = interpolate(pFlow, [0, 1], [300 + pt.y0, 300 + pt.y0 * 0.22]);
        let scale = 1;
        let opacity = interpolate(pFlow, [0, 0.15], [0, 1], clamp);

        // 阶段 2: 进入过滤室后分流 (valid 穿过核心向右 x=980, invalid 向下坠入废料仓 x=760, y=565)
        if (pSep > 0) {
          if (pt.valid) {
            x = interpolate(pSep, [0, 1], [640, 1020]);
            y = interpolate(pSep, [0, 1], [300 + pt.y0 * 0.22, 290 + (idx % 3 - 1) * 28]);
          } else {
            x = interpolate(pSep, [0, 1], [640, 740 + ((idx % 3) - 1) * 42]);
            // 重力加速下坠曲线
            const dropEase = pSep * pSep;
            y = interpolate(dropEase, [0, 1], [300 + pt.y0 * 0.22, 565]);
            scale = interpolate(pSep, [0, 1], [1, 0.78]);
            opacity = interpolate(pSep, [0, 0.85, 1], [0.95, 0.75, 0.45]);
          }
        }

        // 阶段 3: 有效粒子向右侧提纯晶体中心 (x=1245, y=290) 聚合并融入晶体
        if (pt.valid && pTrans > 0) {
          x = interpolate(pTrans, [0, 1], [1020, 1245]);
          y = interpolate(pTrans, [0, 1], [290 + (idx % 3 - 1) * 28, 290]);
          scale = interpolate(pTrans, [0, 0.9, 1], [1.05, 0.5, 0]);
          opacity = interpolate(pTrans, [0, 0.75, 1], [1, 0.8, 0]);
        }

        return (
          <div
            key={pt.id}
            style={{
              position: "absolute",
              left: x - 68,
              top: y - 20,
              width: pt.valid ? 142 : 124,
              height: 40,
              opacity,
              transform: ` translateZ(${pt.z0}px) scale(${scale})`,
              borderRadius: pt.valid ? 999 : 8,
              background: pt.valid
                ? `${theme.accent}22`
                : theme.isLight
                ? "rgba(107, 114, 128, 0.14)"
                : "rgba(51, 65, 85, 0.52)",
              border: pt.valid
                ? `1.5px solid ${theme.accent}`
                : `1px dashed ${theme.textMuted}`,
              boxShadow: pt.valid ? `0 0 18px ${theme.accent}33` : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 12px",
              fontSize: 14,
              fontWeight: pt.valid ? 700 : 500,
              color: pt.valid ? theme.textPrimary : theme.textMuted,
              zIndex: pt.valid ? 25 : 14,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: pt.valid ? "50%" : 2,
                background: pt.valid ? theme.accent : theme.textMuted,
              }}
            />
            <span style={{ whiteSpace: "nowrap" }}>{pt.label}</span>
          </div>
        );
      })}

      {/* 2. 中央：3D 半透明物理过滤装置 (3d_filter_machine) */}
      <div
        style={{
          position: "absolute",
          left: 520,
          top: 95,
          width: 440,
          height: 370,
          borderRadius: 28,
          ...glassStyle,
          opacity: filterMachineYieldOpacity,
          transform: `translateZ(${isFinalCloseUp ? -35 : 15}px)`,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 20,
        }}
      >
        {/* 顶部装置铭牌与实时工作状态 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                color: theme.accent,
                fontWeight: 700,
                letterSpacing: 1.4,
              }}
            >
              CHAMBER // 02
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginTop: 2 }}>
              {normalizeObjectLabel(world.primary_object, labels)}
            </div>
          </div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontFamily: MONO,
              fontWeight: 700,
              background: `${theme.accent}1F`,
              border: `1px solid ${theme.accent}66`,
              color: theme.accent,
            }}
          >
            {sepProgress > 0.1 && sepProgress < 0.95 ? "SEPARATING" : "ACTIVE"}
          </div>
        </div>

        {/* 内部多层物理过滤光栅环与分流阀门结构 */}
        <div
          style={{
            position: "relative",
            height: 210,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "0 16px",
          }}
        >
          {[0, 1, 2].map((ringIdx) => {
            const pulse = Math.sin(f / 10 - ringIdx * 1.1) * 0.5 + 0.5;
            return (
              <div
                key={ringIdx}
                style={{
                  width: 82,
                  height: 176 - ringIdx * 18,
                  borderRadius: 42,
                  border: `2px solid ${
                    ringIdx === 1 ? theme.accent : theme.borderStrong
                  }`,
                  background:
                    ringIdx === 1
                      ? `radial-gradient(ellipse at center, ${theme.accent}${
                          isSeparating ? "30" : "18"
                        }, transparent 75%)`
                      : "transparent",
                  boxShadow:
                    ringIdx === 1
                      ? `0 0 ${18 + pulse * 14}px ${theme.accent}33`
                      : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 0",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: MONO,
                    color: theme.textMuted,
                  }}
                >
                  SIEVE 0{ringIdx + 1}
                </span>
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    margin: "8px 0",
                    background: `linear-gradient(180deg, transparent, ${theme.accent}88, transparent)`,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: MONO,
                    color: ringIdx === 1 ? theme.accent : theme.textMuted,
                  }}
                >
                  {ringIdx === 1 ? "GATE" : "MESH"}
                </span>
              </div>
            );
          })}

          {/* 下方分流排废通道指示箭头 */}
          <div
            style={{
              position: "absolute",
              bottom: -18,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "3px 14px",
              borderRadius: 6,
              background: theme.bgSecondary,
              border: `1px solid ${theme.borderStrong}`,
              fontSize: 12,
              fontFamily: MONO,
              color: theme.textSecondary,
            }}
          >
            ▼ REJECT VALVE ({Math.round(sepProgress * 100)}%)
          </div>
        </div>

        {/* 底部材质与信噪比遥测条 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            fontFamily: MONO,
            color: theme.textMuted,
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 10,
          }}
        >
          <span>MATERIAL: {material.toUpperCase()}</span>
          <span style={{ color: theme.accent }}>
            SNR +{Math.round(interpolate(sepProgress, [0, 1], [12, 96]))} dB
          </span>
        </div>
      </div>

      {/* 3. 中下方：废料回收容器 (waste_container) */}
      <div
        style={{
          position: "absolute",
          left: 590,
          top: 505,
          width: 300,
          height: 135,
          borderRadius: 18,
          background: theme.isLight
            ? "rgba(229, 231, 235, 0.75)"
            : "rgba(15, 19, 28, 0.82)",
          border: `1.5px dashed ${theme.borderStrong}`,
          opacity: wasteYieldOpacity,
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
          <span style={{ fontSize: 12, fontFamily: MONO, color: theme.textMuted }}>
            DISCARDED NOISE
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["寒暄客套", "重复噪声", "无效修饰"].map((tag, i) => (
            <span
              key={i}
              style={{
                fontSize: 13,
                padding: "4px 10px",
                borderRadius: 6,
                background: theme.isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)",
                color: theme.textMuted,
                opacity: interpolate(sepProgress, [i * 0.2, i * 0.2 + 0.4], [0.2, 0.9], clamp),
              }}
            >
              ✕ {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 4. 右侧：提纯凝聚实体晶体 (purified_object) */}
      <div
        style={{
          position: "absolute",
          left: 1055,
          top: 115,
          width: 440,
          height: 340,
          borderRadius: 28,
          ...crystalStyle,
          opacity: interpolate(sepProgress, [0, 0.5], [0.45, 1], clamp),
          transform: `translateZ(${isFinalCloseUp ? 55 : 0}px) scale(${purifiedFocusScale})`,
          padding: "26px 30px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          zIndex: 30,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: 13,
              fontFamily: MONO,
              fontWeight: 700,
              color: theme.accent,
              letterSpacing: 1.4,
            }}
          >
            OUTPUT // 03
          </span>
          <span
            style={{
              fontSize: 13,
              fontFamily: MONO,
              padding: "3px 10px",
              borderRadius: 999,
              background: `${theme.accent}24`,
              color: theme.accent,
              fontWeight: 700,
            }}
          >
            PURITY {Math.round(interpolate(transformProgress, [0, 1], [60, 99.4]))}%
          </span>
        </div>

        {/* 3D 几何提纯晶体核心 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 32,
              transform: `rotate(45deg) scale(${interpolate(
                transformProgress,
                [0, 1],
                [0.62, 1.06]
              )})`,
              background: `linear-gradient(135deg, ${theme.accent}55 0%, ${theme.accent}18 100%)`,
              border: `2px solid ${theme.accent}`,
              boxShadow: `0 0 ${interpolate(transformProgress, [0, 1], [12, 48])}px ${
                theme.accent
              }55, inset 0 0 24px ${theme.accent}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                transform: "rotate(-45deg)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontFamily: MONO,
                  color: theme.accent,
                  fontWeight: 800,
                }}
              >
                DISTILLED
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: theme.textPrimary,
                  marginTop: 4,
                }}
              >
                {normalizeObjectLabel("purified_object", labels)}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 15,
            color: theme.textSecondary,
            textAlign: "center",
            borderTop: `1px solid ${theme.border}`,
            paddingTop: 12,
            fontWeight: 600,
          }}
        >
          高价值结构化事实已结晶锁定
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   物理机制渲染器 2：多层 3D 架构拆解与光路总线舞台 (layered_architecture)
   支持动作：explode_layers / scan_layer / connect_bus / assemble
   ========================================================================== */
const LayeredArchitectureStage: React.FC<{
  f: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  activeBeatIdx: number;
}> = ({ f, duration, theme, material, world, beats, activeBeatIdx }) => {
  const activeBeat = beats[activeBeatIdx] || beats[0];
  const labels = world.object_labels || {};
  const secObjs =
    world.secondary_objects && world.secondary_objects.length > 0
      ? world.secondary_objects
      : ["graph_topology_slab", "vector_index_slab", "sqlite_ledger_slab"];

  const isAssembling = activeBeat?.action === "assemble";
  const isConnectingBus = activeBeat?.action === "connect_bus";
  const explodeT = interpolate(f, [0, Math.min(45, duration * 0.35)], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const assembleT = isAssembling
    ? interpolate(f, [duration * 0.65, duration - 10], [0, 1], {
        ...clamp,
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;

  const spreadFactor = explodeT * (1 - assembleT * 0.65);

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformStyle: "preserve-3d",
      }}
    >
      {/* 贯穿三层的垂直光路数据总线 (Optical Data Bus) */}
      {[360, 780, 1200].map((bx, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: bx,
            top: 85,
            width: isConnectingBus ? 4 : 2,
            height: 510,
            background: `linear-gradient(180deg, transparent, ${theme.accent}${
              isConnectingBus ? "EE" : "66"
            }, transparent)`,
            boxShadow: isConnectingBus ? `0 0 22px ${theme.accent}` : "none",
            zIndex: 15,
          }}
        />
      ))}

      {/* 多层精密架构板 */}
      <div
        style={{
          width: 1080,
          height: 560,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {secObjs.slice(0, 4).map((layerObj, idx) => {
          const objId = normalizeObjectId(layerObj);
          const label = normalizeObjectLabel(layerObj, labels);
          const targeted =
            isTargetMatched(objId, activeBeat?.target || "") ||
            activeBeat?.action === "explode_layers" ||
            activeBeat?.action === "connect_bus";

          const offsetY = (idx - (secObjs.length - 1) / 2) * 32 * spreadFactor;
          const surface = resolveMaterialSurface(material, theme, targeted);

          return (
            <div
              key={objId || idx}
              style={{
                position: "relative",
                height: 132,
                borderRadius: 20,
                ...surface,
                opacity: targeted ? 1 : 0.42,
                transform: `translateY(${offsetY}px) scale(${targeted ? 1.02 : 0.96})`,
                padding: "20px 32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                zIndex: 30 - idx,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
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
                  L{secObjs.length - idx}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: theme.textPrimary }}>
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: MONO,
                      color: theme.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    ID: {objId} · {targeted ? "ACTIVE FOCUS" : "STANDBY YIELD"}
                  </div>
                </div>
              </div>

              {/* 层内物理阵列模块指示器 */}
              <div style={{ display: "flex", gap: 10 }}>
                {[0, 1, 2, 3].map((cell) => (
                  <div
                    key={cell}
                    style={{
                      width: 44,
                      height: 54,
                      borderRadius: 8,
                      border: `1px solid ${targeted ? theme.accent : theme.borderStrong}`,
                      background:
                        targeted && (f + cell * 7) % 24 < 12
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
    </div>
  );
};

/* ==========================================================================
   物理机制渲染器 3：时序状态演进与防篡改印章导轨 (state_timeline_track)
   支持动作：append_state / anchor_timestamp / trace_lineage
   ========================================================================== */
const StateTimelineStage: React.FC<{
  f: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  activeBeatIdx: number;
}> = ({ f, duration, theme, material, world, beats, activeBeatIdx }) => {
  const activeBeat = beats[activeBeatIdx] || beats[0];
  const labels = world.object_labels || {};
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
      {/* 水平精密时间刻度轴 */}
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
        {nodes.slice(0, 4).map((node, idx) => {
          const id = normalizeObjectId(node);
          const label = normalizeObjectLabel(node, labels);
          const isLatest = idx === nodes.length - 1;
          const isFocused =
            isTargetMatched(id, activeBeat?.target || "") ||
            (isLatest && activeBeatIdx === beats.length - 1) ||
            activeBeatIdx === idx;
          const surface = resolveMaterialSurface(material, theme, isFocused);
          const appear = interpolate(
            progress,
            [idx * 0.22, idx * 0.22 + 0.35],
            [0, 1],
            clamp
          );

          return (
            <div
              key={id || idx}
              style={{
                flex: 1,
                borderRadius: 22,
                ...surface,
                padding: "24px 26px",
                opacity: appear * (isFocused ? 1 : 0.45),
                transform: `translateY(${interpolate(appear, [0, 1], [28, 0])}px) scale(${
                  isFocused ? 1.04 : 0.95
                })`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 290,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: isFocused ? theme.accent : theme.textMuted,
                  }}
                >
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
   物理机制渲染器 4：多路信号探针与汇聚棱镜 (multi_probe_router)
   支持动作：emit_probes / weigh_signals / converge_result
   ========================================================================== */
const MultiProbeRouterStage: React.FC<{
  f: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  activeBeatIdx: number;
}> = ({ f, duration, theme, material, world, beats, activeBeatIdx }) => {
  const activeBeat = beats[activeBeatIdx] || beats[0];
  const labels = world.object_labels || {};
  const probes =
    world.secondary_objects && world.secondary_objects.length > 0
      ? world.secondary_objects
      : ["vector_probe", "lexical_probe", "graph_probe", "temporal_probe"];

  const convergeT = interpolate(f, [duration * 0.45, duration - 12], [0, 1], clamp);
  const isConverging =
    activeBeat?.action === "converge_result" || activeBeatIdx === beats.length - 1;

  return (
    <div
      style={{
        position: "relative",
        width: 1560,
        height: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 48px",
      }}
    >
      {/* 左侧：多通道物理探针阵列 */}
      <div
        style={{
          width: 740,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          opacity: isConverging ? 0.46 : 1,
        }}
      >
        {probes.slice(0, 4).map((pr, idx) => {
          const id = normalizeObjectId(pr);
          const label = normalizeObjectLabel(pr, labels);
          const weights = [94, 88, 96, 98];
          const wScore = Math.round(
            interpolate(f, [idx * 8, idx * 8 + 42], [0, weights[idx % 4]], clamp)
          );
          const surface = resolveMaterialSurface(material, theme, !isConverging);

          return (
            <div
              key={id || idx}
              style={{
                borderRadius: 16,
                ...surface,
                padding: "16px 24px",
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

              <div style={{ display: "flex", alignItems: "center", gap: 16, width: 240 }}>
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
                    width: 48,
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

      {/* 右侧：信号合成光学棱镜核心 */}
      <div
        style={{
          width: 520,
          height: 380,
          borderRadius: 28,
          ...resolveMaterialSurface(material, theme, true),
          transform: `scale(${isConverging ? 1.08 : 0.96})`,
          padding: "28px 34px",
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
          <span>SYNTHESIS PRISM</span>
          <span>CONFIDENCE {Math.round(interpolate(convergeT, [0, 1], [72, 98.6]))}%</span>
        </div>

        <div
          style={{
            width: 156,
            height: 156,
            borderRadius: "50%",
            border: `2.5px solid ${theme.accent}`,
            background: `radial-gradient(circle, ${theme.accent}44 0%, transparent 72%)`,
            boxShadow: `0 0 42px ${theme.accent}44`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 21,
            fontWeight: 900,
            color: theme.textPrimary,
            textAlign: "center",
            padding: 16,
          }}
        >
          {normalizeObjectLabel(world.primary_object, labels)}
        </div>

        <div
          style={{
            fontSize: 15,
            color: theme.textSecondary,
            fontWeight: 600,
          }}
        >
          多路正交信号加权收敛完成
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   物理机制渲染器 5：空间负载超载 vs 精准抽取对比舞台 (physical_balance_stage)
   支持动作：overload_collapse / precision_extract / compare_split
   ========================================================================== */
const PhysicalBalanceContrastStage: React.FC<{
  f: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  activeBeatIdx: number;
}> = ({ f, duration, theme, material, world, beats, activeBeatIdx }) => {
  const activeBeat = beats[activeBeatIdx] || beats[0];
  const labels = world.object_labels || {};
  const isPrecisionPhase =
    activeBeatIdx > 0 ||
    activeBeat?.action === "precision_extract" ||
    activeBeat?.action === "transform";

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
      {/* 左台：传统冗余堆叠负载 (在阶段 2 自动让位暗化) */}
      <div
        style={{
          flex: 1,
          height: 460,
          borderRadius: 24,
          ...resolveMaterialSurface(material, theme, !isPrecisionPhase),
          opacity: isPrecisionPhase ? 0.36 : 1,
          transform: `scale(${isPrecisionPhase ? 0.94 : 1.02})`,
          padding: "28px 32px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontFamily: MONO, color: theme.textMuted, fontWeight: 700 }}>
            BASELINE // UNFILTERED LOAD
          </span>
          <span style={{ fontSize: 13, fontFamily: MONO, color: "#F43F5E", fontWeight: 700 }}>
            OVERLOAD STRAIN
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
                border: `1px solid ${
                  blk === 2 ? "#F43F5E" : theme.borderStrong
                }`,
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
                {blk === 2 ? "CRITICAL SIGNAL (BURIED IN STACK)" : `REDUNDANT BLOCK #0${blk + 1}`}
              </span>
              <span>4.2k TOKENS</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 15, color: theme.textSecondary }}>
          全量冗余堆积导致核心信号被淹没
        </div>
      </div>

      {/* 右台：精准结构化索引抽取 */}
      <div
        style={{
          flex: 1.15,
          height: 460,
          borderRadius: 24,
          ...resolveMaterialSurface(material, theme, isPrecisionPhase),
          opacity: isPrecisionPhase ? 1 : 0.55,
          transform: `scale(${isPrecisionPhase ? 1.05 : 0.96})`,
          padding: "28px 34px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontFamily: MONO, color: theme.accent, fontWeight: 700 }}>
            MECHANISM // PRECISION INDEX
          </span>
          <span style={{ fontSize: 13, fontFamily: MONO, color: theme.accent, fontWeight: 700 }}>
            O(1) DIRECT RETRIEVAL
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
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: MONO,
                    color: theme.accent,
                    fontWeight: 700,
                  }}
                >
                  VERIFIED NODE
                </span>
              </div>
            ))}
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent }}>
          精准召回目标节点，其余冗余零加载
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   物理机制渲染器 6：真实代码、终端与产品演示演播室 (product_demo / authentic_assets)
   遵守原则 3：真实素材优先，行级聚焦高亮，其余行主动暗化让位
   ========================================================================== */
const AuthenticProductDemoStage: React.FC<{
  f: number;
  duration: number;
  theme: ResolvedTheme;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  activeBeatIdx: number;
}> = ({ f, duration, theme, world, beats, activeBeatIdx }) => {
  const activeBeat = beats[activeBeatIdx] || beats[0];
  const assets = world.authentic_assets || {};
  const code =
    assets.code_snippet ||
    `# Authentic implementation viewport\nfrom core.engine import Pipeline\n\npipeline = Pipeline(mode="strict_v4")\nresult = pipeline.run(input_stream)\nprint(result.metrics)`;
  const codeLines = code.split("\n");
  const commands = assets.terminal_commands || [];
  const metrics = assets.metrics || [];

  const highlightLines: number[] =
    activeBeat?.payload?.lines ||
    assets.highlight_lines ||
    (activeBeatIdx > 0 ? [3, 4, 5] : []);

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
      {/* 左侧/主视口：真实源码编辑器视口 */}
      <div
        style={{
          flex: commands.length > 0 ? 1.35 : 1.7,
          borderRadius: 20,
          background: "#0D1117",
          border: `1.5px solid ${theme.accent}88`,
          boxShadow: "0 28px 64px rgba(0,0,0,0.68)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 窗口顶栏 */}
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

        {/* 代码行（支持行级焦点让位） */}
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
                    hasFocusFilter && isHighlighted
                      ? `${theme.accent}1C`
                      : "transparent",
                  borderLeft:
                    hasFocusFilter && isHighlighted
                      ? `3px solid ${theme.accent}`
                      : "3px solid transparent",
                  opacity: isHighlighted ? 1 : 0.3,
                }}
              >
                <span
                  style={{
                    width: 38,
                    color: "#6E7681",
                    fontSize: 15,
                    userSelect: "none",
                  }}
                >
                  {String(lineNum).padStart(2, "0")}
                </span>
                <span style={{ color: "#E6EDF3", whiteSpace: "pre" }}>{line}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右侧：真实终端执行或实测指标面板 */}
      {(commands.length > 0 || metrics.length > 0) && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {commands.length > 0 && (
            <div
              style={{
                flex: 1.2,
                borderRadius: 20,
                background: "#090D14",
                border: `1px solid rgba(255,255,255,0.16)`,
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
   主组件：ChoreographedScene (驱动所有 v4 visual_choreography 分镜)
   ========================================================================== */
export const ChoreographedScene: React.FC<{
  scene: SceneV4Props;
  globalArtDirection?: GlobalArtDirection;
}> = ({ scene, globalArtDirection }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const duration = scene.durationInFrames || durationInFrames || 120;

  const art = scene.art_direction || {};
  const world: VisualWorldSpec = scene.visual_world || {
    environment: "minimal_physical_laboratory",
    primary_object: "3d_filter_machine",
    secondary_objects: ["information_particles", "waste_container", "purified_object"],
  };
  const beats: ChoreographyBeat[] =
    scene.visual_choreography && scene.visual_choreography.length > 0
      ? scene.visual_choreography
      : [
          {
            beat: "核心机制演示",
            action: "transform",
            target: normalizeObjectId(world.primary_object),
            description: scene.visual_intent || scene.narration,
            camera: "slow_dolly_in",
          },
        ];

  const theme = resolveArtTheme(art, globalArtDirection);
  const material = art.material || "translucent_glass";

  // 1. 解析每个动作节拍 (Beat) 的精确起止帧窗口
  const beatWindows = beats.map((b, idx) => {
    const timed = scene.beat_timings?.[idx];
    if (timed && typeof timed.start_frame === "number" && typeof timed.end_frame === "number") {
      return { start: timed.start_frame, end: timed.end_frame };
    }
    const step = duration / beats.length;
    return {
      start: Math.floor(idx * step),
      end: Math.floor((idx + 1) * step),
    };
  });

  let activeBeatIdx = 0;
  for (let i = 0; i < beatWindows.length; i++) {
    if (f >= beatWindows[i].start && f <= beatWindows[i].end) {
      activeBeatIdx = i;
      break;
    }
    if (f > beatWindows[i].end) {
      activeBeatIdx = i;
    }
  }
  const activeBeat = beats[activeBeatIdx] || beats[0];

  // 2. 构建跨节拍连续 Hermite 样条相机运镜
  const keyFrames: number[] = [0];
  const poses = [cameraPoseForBeat(beats[0]?.camera, beats[0]?.shot_scale, 0)];

  beatWindows.forEach((win, i) => {
    const mid = Math.max(
      keyFrames[keyFrames.length - 1] + 1,
      Math.floor((win.start + win.end) / 2)
    );
    keyFrames.push(mid);
    poses.push(cameraPoseForBeat(beats[i]?.camera, beats[i]?.shot_scale, i));
  });
  if (keyFrames[keyFrames.length - 1] < duration) {
    keyFrames.push(duration);
    poses.push(poses[poses.length - 1]);
  }

  const scaleSpline = hermiteSpline(
    keyFrames,
    poses.map((p) => p.scale)
  );
  const rotXSpline = hermiteSpline(
    keyFrames,
    poses.map((p) => p.rotX)
  );
  const rotYSpline = hermiteSpline(
    keyFrames,
    poses.map((p) => p.rotY)
  );
  const txSpline = hermiteSpline(
    keyFrames,
    poses.map((p) => p.tx)
  );
  const tySpline = hermiteSpline(
    keyFrames,
    poses.map((p) => p.ty)
  );

  const camScale = scaleSpline(f);
  const camRotX = rotXSpline(f);
  const camRotY = rotYSpline(f);
  const camTx = txSpline(f);
  const camTy = tySpline(f);

  // 3. 根据 primary_object 与 style 路由到对应的物理机制舞台
  const primaryId = normalizeObjectId(world.primary_object).toLowerCase();
  const actionsStr = beats.map((b) => b.action).join(" ");

  const isProductOrCode =
    art.style === "product_demo" ||
    primaryId.includes("code") ||
    primaryId.includes("terminal") ||
    primaryId.includes("ui") ||
    Boolean(world.authentic_assets?.code_snippet) ||
    Boolean(world.authentic_assets?.terminal_commands?.length);

  const isFilterStage =
    primaryId.includes("filter") ||
    primaryId.includes("funnel") ||
    actionsStr.includes("particles_flow") ||
    actionsStr.includes("separate");

  const isTimelineStage =
    primaryId.includes("timeline") ||
    actionsStr.includes("append_state") ||
    actionsStr.includes("anchor_timestamp") ||
    actionsStr.includes("trace_lineage");

  const isRouterStage =
    primaryId.includes("router") ||
    primaryId.includes("probe") ||
    actionsStr.includes("emit_probes") ||
    actionsStr.includes("weigh_signals") ||
    actionsStr.includes("converge_result");

  const isBalanceStage =
    primaryId.includes("balance") ||
    primaryId.includes("contrast") ||
    actionsStr.includes("overload_collapse") ||
    actionsStr.includes("precision_extract") ||
    actionsStr.includes("compare_split");

  const overlays = scene.text_overlays || [];

  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        color: theme.textPrimary,
        padding: "38px 72px 136px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* 顶部编辑级信息栏 (Editorial Header) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          zIndex: 45,
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                padding: "3px 12px",
                borderRadius: 4,
                background: `${theme.accent}22`,
                border: `1px solid ${theme.accent}`,
                color: theme.accent,
                fontSize: 13,
                fontFamily: MONO,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              {scene.chapter || scene.id.toUpperCase()}
            </span>
            {scene.continuity_group && (
              <span
                style={{
                  fontSize: 13,
                  fontFamily: MONO,
                  color: theme.textMuted,
                }}
              >
                CONTINUOUS SET // {scene.continuity_group}
              </span>
            )}
          </div>
          <h2
            style={{
              margin: "8px 0 0",
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: -0.5,
              color: theme.textPrimary,
            }}
          >
            {scene.title || scene.visual_intent || scene.id}
          </h2>
        </div>

        {/* 右上角：当前动作节拍 (Beat) 与镜头调度遥测 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {beats.map((b, bi) => {
              const active = bi === activeBeatIdx;
              return (
                <span
                  key={bi}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: active ? 800 : 500,
                    background: active ? theme.accent : theme.surface,
                    color: active ? "#0B0D12" : theme.textMuted,
                    border: `1px solid ${active ? theme.accent : theme.border}`,
                  }}
                >
                  {bi + 1}. {b.beat}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 13, fontFamily: MONO, color: theme.textMuted }}>
            CAM: {(activeBeat?.camera || "steady_hold").toUpperCase()} · TARGET:{" "}
            {activeBeat?.target}
          </div>
        </div>
      </div>

      {/* 中央：3D 连续运镜主视口 */}
      <div
        style={{
          flex: 1,
          position: "relative",
          perspective: "1800px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: " visible",
        }}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `translate3d(${camTx.toFixed(1)}px, ${camTy.toFixed(
              1
            )}px, 0px) scale(${camScale.toFixed(3)}) rotateX(${camRotX.toFixed(
              2
            )}deg) rotateY(${camRotY.toFixed(2)}deg)`,
          }}
        >
          {isProductOrCode ? (
            <AuthenticProductDemoStage
              f={f}
              duration={duration}
              theme={theme}
              world={world}
              beats={beats}
              activeBeatIdx={activeBeatIdx}
            />
          ) : isFilterStage ? (
            <FilterLaboratoryStage
              f={f}
              fps={fps}
              duration={duration}
              theme={theme}
              material={material}
              world={world}
              beats={beats}
              beatWindows={beatWindows}
              activeBeatIdx={activeBeatIdx}
            />
          ) : isTimelineStage ? (
            <StateTimelineStage
              f={f}
              duration={duration}
              theme={theme}
              material={material}
              world={world}
              beats={beats}
              activeBeatIdx={activeBeatIdx}
            />
          ) : isRouterStage ? (
            <MultiProbeRouterStage
              f={f}
              duration={duration}
              theme={theme}
              material={material}
              world={world}
              beats={beats}
              activeBeatIdx={activeBeatIdx}
            />
          ) : isBalanceStage ? (
            <PhysicalBalanceContrastStage
              f={f}
              duration={duration}
              theme={theme}
              material={material}
              world={world}
              beats={beats}
              activeBeatIdx={activeBeatIdx}
            />
          ) : (
            <LayeredArchitectureStage
              f={f}
              duration={duration}
              theme={theme}
              material={material}
              world={world}
              beats={beats}
              activeBeatIdx={activeBeatIdx}
            />
          )}
        </div>

        {/* 克制的屏幕批注层 (text_overlays) */}
        {overlays.length > 0 && (
          <div
            style={{
              position: "absolute",
              right: 24,
              bottom: 18,
              display: "flex",
              gap: 14,
              zIndex: 50,
            }}
          >
            {overlays.slice(0, 3).map((ov, idx) => {
              const show =
                ov.beat_index === undefined || ov.beat_index === activeBeatIdx;
              if (!show) return null;
              return (
                <div
                  key={idx}
                  style={{
                    padding: "10px 22px",
                    borderRadius: 10,
                    background: theme.surfaceElevated,
                    border: `1.5px solid ${theme.accent}`,
                    boxShadow: `0 12px 28px ${theme.shadowColor}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: theme.accent,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: theme.textPrimary,
                    }}
                  >
                    {ov.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 左下角：当前节拍物理动作说明 */}
        {activeBeat?.description && (
          <div
            style={{
              position: "absolute",
              left: 20,
              bottom: 18,
              padding: "8px 18px",
              borderRadius: 8,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              fontSize: 16,
              color: theme.textSecondary,
              zIndex: 45,
            }}
          >
            <strong style={{ color: theme.accent, marginRight: 8 }}>
              [{activeBeat.beat}]
            </strong>
            {activeBeat.description}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
