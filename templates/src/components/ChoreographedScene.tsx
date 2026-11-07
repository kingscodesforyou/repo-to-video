import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FONT,
  MONO,
  GlobalArtDirection,
  SceneArtDirection,
  resolveArtTheme,
} from "../theme";
import {
  CameraConfig,
  ChoreographyBeat,
  VisualWorldSpec,
  createYieldStyleResolver,
  getObject3DCoords,
  normalizeObjectId,
  resolveSceneRenderer,
} from "../registry/RendererRegistry";
import registryManifest from "../registry/registry_manifest.json";
import { assertAnimationScene } from "../registry/AnimationContract";

export type { ChoreographyBeat, VisualWorldSpec };

export interface BeatTiming {
  beat_index: number;
  beat: string;
  action: string;
  target: string;
  camera?: string;
  shot_scale?: string;
  start_frame?: number;
  end_frame?: number;
  startFrame?: number;
  endFrame?: number;
  mid_frame?: number;
}

export interface TextOverlayItem {
  text: string;
  role: "annotation" | "metric" | "caption" | "callout" | string;
  beat_index?: number;
}

export interface CameraPose3D {
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface SceneV4Props {
  id: string;
  renderer_id?: string;
  visual_mode?: "2d_editorial" | "3d_spatial" | "hybrid" | string;
  learning_objective?: string;
  visual_explanation?: string;
  expected_understanding?: string;
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
  initialCameraPose?: CameraPose3D;
  debugMode?: boolean;
}

/** 单调三次 Hermite 样条插值：用于跨节拍与跨连续镜头的平滑 3D 相机轨迹 */
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

/**
 * 真实 3D 目标追踪相机姿态解算器 (3D Target-Tracking Camera Solver v4.2)：
 * 结合 camera 预设、shot_scale 景别、以及 beat.target 在 3D 空间中的真实坐标 [objX, objY, objZ]，
 * 动态解算相机的 scale, rotX, rotY, rotZ (Roll), tx, ty, tz。
 */
export function cameraPoseForBeat(
  camera: string = "steady_hold",
  shotScale: string = "medium",
  beatIndex: number = 0,
  targetId: string = "",
  cameraConfig?: CameraConfig,
  visualMode: string = "3d_spatial"
): CameraPose3D {
  const is2D = visualMode === "2d_editorial";
  let scale = 1.0;
  let focusPullStrength = is2D ? 0.08 : 0.14;
  if (shotScale === "wide") {
    scale = is2D ? 0.96 : 0.92;
    focusPullStrength = is2D ? 0.04 : 0.06;
  } else if (shotScale === "medium") {
    scale = is2D ? 1.0 : 1.02;
    focusPullStrength = is2D ? 0.08 : 0.14;
  } else if (shotScale === "close_up") {
    scale = is2D ? 1.06 : 1.15;
    focusPullStrength = is2D ? 0.12 : 0.24;
  } else if (shotScale === "macro") {
    scale = is2D ? 1.1 : 1.24;
    focusPullStrength = is2D ? 0.16 : 0.32;
  }

  const speedFactor =
    cameraConfig?.speed === "slow"
      ? 0.75
      : cameraConfig?.speed === "fast"
      ? 1.25
      : typeof cameraConfig?.speed === "number"
      ? cameraConfig.speed
      : 1.0;

  // 查询焦点目标在舞台中的坐标 [x, y, z]
  const lookAtTarget = cameraConfig?.lookAt || targetId;
  const [objX, objY, objZ] = getObject3DCoords(lookAtTarget);

  // v4.4: 2D 正视模式严禁任何三维倾斜 (rotX=0, rotY=0, rotZ=0, tz=0)，仅允许平面平移与温和缩放
  if (is2D) {
    let tx = -objX * focusPullStrength * speedFactor;
    let ty = -objY * focusPullStrength * speedFactor;
    switch (camera) {
      case "slow_dolly_in":
        scale *= 1.02;
        break;
      case "dolly_out":
        scale *= 0.97;
        break;
      case "close_up":
        scale = Math.max(scale, 1.05);
        tx = -objX * 0.1;
        ty = -objY * 0.08;
        break;
      case "macro_focus":
        scale = Math.max(scale, 1.08);
        tx = -objX * 0.12;
        ty = -objY * 0.1;
        break;
      case "track_horizontal":
        tx = -objX * 0.08 + (beatIndex % 2 === 0 ? 12 : -12) * speedFactor;
        break;
      case "track_vertical":
        ty = -objY * 0.08 + (beatIndex === 0 ? 10 : -10) * speedFactor;
        break;
      case "steady_hold":
      default:
        tx = 0;
        ty = 0;
        scale = 1.0;
        break;
    }
    return { scale, rotX: 0, rotY: 0, rotZ: 0, tx, ty, tz: 0 };
  }

  // 相机向目标实体平滑摇摄对焦 (Target LookAt Offset)
  let tx = -objX * focusPullStrength * speedFactor;
  let ty = -objY * focusPullStrength * speedFactor;
  let tz = objZ * 0.35;
  let rotX = 10 - (objY / 260) * 3.5;
  let rotY = -4 + (objX / 420) * 5.5;
  let rotZ = 0;

  switch (camera) {
    case "slow_dolly_in":
      scale *= 1.06;
      rotX = 12 - (objY / 260) * 3;
      rotY = -6 + (objX / 420) * 5;
      rotZ = 0;
      tz += 35 * speedFactor;
      break;
    case "dolly_out":
      scale *= 0.92;
      rotX = 15;
      rotY = -4;
      rotZ = 0;
      tz -= 40 * speedFactor;
      break;
    case "close_up":
      scale = Math.max(scale, 1.16);
      rotX = 8 - (objY / 260) * 2.5;
      rotY = -3 + (objX / 400) * 6;
      rotZ = 0;
      tx = -objX * 0.22;
      ty = -objY * 0.18;
      tz += 55;
      break;
    case "macro_focus":
      scale = Math.max(scale, 1.24);
      rotX = 6;
      rotY = -2 + (objX / 380) * 6.5;
      rotZ = 0;
      tx = -objX * 0.28;
      ty = -objY * 0.22;
      tz += 80;
      break;
    case "track_horizontal":
      rotX = 10;
      rotY = (beatIndex % 2 === 0 ? 5 : -5) + (objX / 450) * 4;
      rotZ = 0;
      tx = -objX * 0.18 + (beatIndex % 2 === 0 ? 18 : -18) * speedFactor;
      break;
    case "track_vertical":
      rotX = 14 - (objY / 220) * 4;
      rotY = -5;
      rotZ = 0;
      ty = -objY * 0.24 + (beatIndex === 0 ? 20 : -20) * speedFactor;
      break;
    case "orbit_left":
      rotX = 14;
      rotY = -15 + (objX / 450) * 4;
      rotZ = -2.2 * speedFactor;
      break;
    case "orbit_right":
      rotX = 14;
      rotY = 14 + (objX / 450) * 4;
      rotZ = 2.2 * speedFactor;
      break;
    case "isometric_tilt":
      rotX = 22;
      rotY = -16;
      rotZ = -3.5 * speedFactor;
      break;
    case "top_down_overview":
      rotX = 30;
      rotY = 0;
      rotZ = 0;
      scale *= 0.95;
      tz -= 25;
      break;
    case "steady_hold":
    default:
      rotX = 9;
      rotY = -4 + (objX / 480) * 3;
      rotZ = 0;
      break;
  }

  return { scale, rotX, rotY, rotZ, tx, ty, tz };
}

/**
 * 统一解析每个 Beat 的起止帧窗口（同时兼容 snake_case start_frame/end_frame 与 camelCase startFrame/endFrame）
 */
export function resolveBeatWindows(
  beats: ChoreographyBeat[],
  beatTimings: BeatTiming[] | undefined,
  duration: number
): Array<{ start: number; end: number }> {
  return beats.map((b, idx) => {
    const timed = beatTimings?.[idx];
    const startVal =
      timed?.start_frame ?? timed?.startFrame ?? b.start_frame ?? b.startFrame;
    const endVal =
      timed?.end_frame ?? timed?.endFrame ?? b.end_frame ?? b.endFrame;

    if (typeof startVal === "number" && typeof endVal === "number" && endVal > startVal) {
      return { start: startVal, end: endVal };
    }
    const step = duration / Math.max(1, beats.length);
    return {
      start: Math.floor(idx * step),
      end: Math.floor((idx + 1) * step),
    };
  });
}

/** 计算镜头结束帧的相机姿态，供同一 continuity_group 的下一镜无缝继承 */
export function computeEndingCameraPose(scene: {
  visual_mode?: string;
  visual_choreography?: ChoreographyBeat[];
}): CameraPose3D {
  const beats = scene.visual_choreography || [];
  const mode = scene.visual_mode || "3d_spatial";
  if (beats.length === 0) {
    return cameraPoseForBeat("steady_hold", "medium", 0, "", undefined, mode);
  }
  const lastIdx = beats.length - 1;
  const lastBeat = beats[lastIdx];
  return cameraPoseForBeat(
    lastBeat.camera,
    lastBeat.shot_scale,
    lastIdx,
    lastBeat.target,
    lastBeat.camera_config,
    mode
  );
}

/** 计算当前帧針對 background_grid 的让位样式，供 Background.tsx 同步降暗或虚化空间网格 */
export function resolveActiveGridYieldStyle(
  scene: {
    visual_choreography?: ChoreographyBeat[];
    beat_timings?: BeatTiming[];
    visual_world?: VisualWorldSpec;
  },
  f: number,
  duration: number
): React.CSSProperties {
  const beats = scene.visual_choreography || [];
  if (beats.length === 0) return { opacity: 1 };
  const beatWindows = resolveBeatWindows(beats, scene.beat_timings, duration);
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
  const activeBeat = beats[activeBeatIdx];
  const activeWin = beatWindows[activeBeatIdx] || { start: 0, end: duration };
  const beatProgress = interpolate(
    f,
    [activeWin.start, Math.max(activeWin.start + 1, activeWin.end)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const resolver = createYieldStyleResolver(
    activeBeat,
    beatProgress,
    scene.visual_world?.object_labels
  );
  return resolver("background_grid");
}

/* ==========================================================================
   主组件：ChoreographedScene (v4.2 可执行视觉编排引擎)
   - 严格通过 scene.renderer_id 路由到 RendererRegistry 中的组件，零启发式降级
   - 完整实现 3D 相机（含 rotZ Roll 插值、基于 target 3D 坐标的 lookAt 对焦、跨连续镜头姿态继承）
   - 正式成片彻底移除 description 说明卡片与右上角遥测标签（仅 debugMode=true 时显示）
   ========================================================================== */
export const ChoreographedScene: React.FC<{
  scene: SceneV4Props;
  globalArtDirection?: GlobalArtDirection;
}> = ({ scene, globalArtDirection }) => {
  assertAnimationScene(scene);
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
      : [];

  const envConfig =
    (registryManifest.supported_environments as Record<string, any>)[world.environment] ||
    registryManifest.supported_environments.minimal_physical_laboratory;

  const theme = resolveArtTheme(
    {
      ...art,
      theme: art.theme || envConfig.theme_default,
    },
    globalArtDirection
  );
  const material = art.material || "translucent_glass";

  // 1. 解析每个动作节拍 (Beat) 的精确起止帧窗口（兼容 snake_case 与 camelCase）
  const beatWindows = resolveBeatWindows(beats, scene.beat_timings, duration);

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

  const activeBeat: ChoreographyBeat = beats[activeBeatIdx] || {
    beat: "UNSPECIFIED",
    phrase_anchor: "",
    action: "unregistered",
    target: "",
    description: "",
  };
  const activeWin = beatWindows[activeBeatIdx] || { start: 0, end: duration };
  const beatProgress = interpolate(
    f,
    [activeWin.start, Math.max(activeWin.start + 1, activeWin.end)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 2. 构建跨节拍与跨连续镜头的 Hermite 样条相机轨迹（2D 模式严格锁定 rotX=rotY=rotZ=tz=0）
  const visualMode = scene.visual_mode || "3d_spatial";
  const is2D = visualMode === "2d_editorial";
  const isHybrid = visualMode === "hybrid";

  const firstBeatPose =
    scene.initialCameraPose && !is2D
      ? scene.initialCameraPose
      : cameraPoseForBeat(
          beats[0]?.camera,
          beats[0]?.shot_scale,
          0,
          beats[0]?.target,
          beats[0]?.camera_config,
          visualMode
        );

  const keyFrames: number[] = [0];
  const poses: CameraPose3D[] = [firstBeatPose];

  beatWindows.forEach((win, i) => {
    const mid = Math.max(
      keyFrames[keyFrames.length - 1] + 1,
      Math.floor((win.start + win.end) / 2)
    );
    keyFrames.push(mid);
    poses.push(
      cameraPoseForBeat(
        beats[i]?.camera,
        beats[i]?.shot_scale,
        i,
        beats[i]?.target,
        beats[i]?.camera_config,
        visualMode
      )
    );
  });
  if (keyFrames[keyFrames.length - 1] < duration) {
    keyFrames.push(duration);
    poses.push(poses[poses.length - 1]);
  }

  const scaleSpline = hermiteSpline(keyFrames, poses.map((p) => p.scale));
  const rotXSpline = hermiteSpline(keyFrames, poses.map((p) => p.rotX));
  const rotYSpline = hermiteSpline(keyFrames, poses.map((p) => p.rotY));
  const rotZSpline = hermiteSpline(keyFrames, poses.map((p) => p.rotZ));
  const txSpline = hermiteSpline(keyFrames, poses.map((p) => p.tx));
  const tySpline = hermiteSpline(keyFrames, poses.map((p) => p.ty));
  const tzSpline = hermiteSpline(keyFrames, poses.map((p) => p.tz));

  const camScale = scaleSpline(f);
  const camRotX = is2D ? 0 : rotXSpline(f);
  const camRotY = is2D ? 0 : rotYSpline(f);
  const camRotZ = is2D ? 0 : rotZSpline(f);
  const camTx = txSpline(f);
  const camTy = tySpline(f);
  const camTz = is2D ? 0 : tzSpline(f);

  // 3. 严格通过 scene.renderer_id 获取注册渲染组件（零启发式猜测或静默降级！）
  const primaryId = normalizeObjectId(world.primary_object);
  const actionsList = beats.map((b) => b.action);
  const matchedRenderer = resolveSceneRenderer(scene.renderer_id);

  const getYieldStyle = createYieldStyleResolver(
    activeBeat,
    beatProgress,
    world.object_labels,
    visualMode
  );
  const overlays = scene.text_overlays || [];
  const hybridLabels = isHybrid ? Object.entries(world.object_labels || {}) : [];

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

        {/* 右上角：当前动作节拍 (Beat) 指示器（遥测信息仅在 debugMode=true 时显示） */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          {scene.debugMode && (
            <div style={{ fontSize: 12, fontFamily: MONO, color: theme.textMuted }}>
              RENDERER: {matchedRenderer?.id || "UNREGISTERED"} · CAM:{" "}
              {(activeBeat?.camera || "steady_hold").toUpperCase()} · TARGET:{" "}
              {activeBeat?.target || "NONE"}
            </div>
          )}
        </div>
      </div>

      {/* 中央视口：根据 visual_mode 严格区分 2d_editorial (正交零倾斜) / 3d_spatial / hybrid (3D主体+2D正交层) */}
      <div
        data-visual-mode={visualMode}
        style={{
          flex: 1,
          position: "relative",
          perspective: is2D ? "none" : `${envConfig.perspective_px || 1800}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
        }}
      >
        <div
          data-stage-projection={is2D ? "orthographic_2d" : "perspective_3d"}
          style={{
            transformStyle: is2D ? "flat" : "preserve-3d",
            transform: is2D
              ? `translate(${camTx.toFixed(1)}px, ${camTy.toFixed(1)}px) scale(${camScale.toFixed(
                  3
                )})`
              : `translate3d(${camTx.toFixed(1)}px, ${camTy.toFixed(
                  1
                )}px, ${camTz.toFixed(1)}px) scale(${camScale.toFixed(
                  3
                )}) rotateX(${camRotX.toFixed(2)}deg) rotateY(${camRotY.toFixed(
                  2
                )}deg) rotateZ(${camRotZ.toFixed(2)}deg)`,
          }}
        >
          {matchedRenderer ? (
            matchedRenderer.render({
              f,
              fps,
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
            })
          ) : (
            <div
              style={{
                width: 960,
                padding: 40,
                borderRadius: 20,
                background: "rgba(127, 29, 29, 0.92)",
                border: "2px solid #F43F5E",
                color: "#FFE4E6",
                fontFamily: MONO,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>
                [RENDERER REGISTRY ERROR] 未找到声明的 renderer_id 组件
              </div>
              <div style={{ fontSize: 16 }}>
                Scene: {scene.id} | Declared renderer_id: {scene.renderer_id || "MISSING"} |
                Primary Object: {primaryId} | Actions: {actionsList.join(", ")}
              </div>
              <div style={{ fontSize: 14, marginTop: 8, color: "#FDA4AF" }}>
                请在分镜中显式声明 renderer-registry.json 中已注册的 renderer_id，或由 Motion
                Designer 在 templates/src/registry/RendererRegistry.tsx 中注册新组件。
              </div>
            </div>
          )}
        </div>

        {/* Hybrid 专属：2D 正视教学信息层 (不随 3D 主体旋转或透视倾斜，文字始终 100% 水平清晰) */}
        {isHybrid && (hybridLabels.length > 0 || scene.learning_objective) && (
          <div
            data-hybrid-2d-layer="true"
            style={{
              position: "absolute",
              left: 16,
              top: 14,
              right: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              pointerEvents: "none",
              transform: "none",
              perspective: "none",
              zIndex: 48,
            }}
          >
            {scene.learning_objective && (
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  background: theme.surfaceElevated,
                  border: `1.5px solid ${theme.accent}`,
                  boxShadow: `0 10px 24px ${theme.shadowColor}`,
                  fontSize: 15,
                  fontWeight: 700,
                  color: theme.textPrimary,
                  maxWidth: 620,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: theme.accent,
                    marginRight: 8,
                    fontWeight: 800,
                  }}
                >
                  2D HUD // 教学目标
                </span>
                {scene.learning_objective}
              </div>
            )}
            {hybridLabels.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {hybridLabels.slice(0, 3).map(([objId, labelText]) => {
                  const isFocused = objId === activeBeat?.target;
                  return (
                    <div
                      key={objId}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        background: isFocused
                          ? `${theme.accent}26`
                          : theme.surfaceElevated,
                        border: `1.5px solid ${
                          isFocused ? theme.accent : theme.borderStrong
                        }`,
                        fontSize: 14,
                        fontWeight: 700,
                        color: theme.textPrimary,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 11,
                          color: theme.accent,
                          marginRight: 6,
                        }}
                      >
                        {isFocused ? "● FOCUS" : "○ 2D LABEL"}
                      </span>
                      {labelText}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 克制的屏幕批注层 (text_overlays, 上限 2 条) */}
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
            {overlays.slice(0, 2).map((ov, idx) => {
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

        {/* description 正式成片完全关闭！仅当显式开启 debugMode=true 时显示 */}
        {scene.debugMode && activeBeat?.description && (
          <div
            style={{
              position: "absolute",
              left: 20,
              bottom: 18,
              padding: "6px 14px",
              borderRadius: 6,
              background: "rgba(0,0,0,0.75)",
              border: "1px dashed #64748B",
              fontSize: 13,
              fontFamily: MONO,
              color: "#94A3B8",
              zIndex: 45,
            }}
          >
            [DEBUG NOTE] {activeBeat.description}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
