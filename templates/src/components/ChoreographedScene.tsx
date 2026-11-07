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
  ChoreographyBeat,
  VisualWorldSpec,
  createYieldStyleResolver,
  normalizeObjectId,
  resolveSceneRenderer,
} from "../registry/RendererRegistry";
import registryManifest from "../registry/registry_manifest.json";

export type { ChoreographyBeat, VisualWorldSpec };

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

export interface SceneV4Props {
  id: string;
  renderer_id?: string;
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
  debugMode?: boolean;
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

  let rotX = 11;
  let rotY = -5;
  let tx = 0;
  let ty = 0;

  switch (camera) {
    case "slow_dolly_in":
      scale *= 1.06;
      rotX = 13;
      rotY = -7;
      tx = 24;
      break;
    case "dolly_out":
      scale *= 0.92;
      rotX = 15;
      rotY = -4;
      break;
    case "close_up":
      scale = Math.max(scale, 1.16);
      rotX = 8;
      rotY = -4;
      tx = -55;
      ty = -8;
      break;
    case "macro_focus":
      scale = Math.max(scale, 1.24);
      rotX = 6;
      rotY = -2;
      tx = -75;
      break;
    case "track_horizontal":
      rotX = 10;
      rotY = beatIndex % 2 === 0 ? 5 : -5;
      tx = -14;
      break;
    case "track_vertical":
      rotX = 15;
      rotY = -6;
      ty = beatIndex === 0 ? 22 : -22;
      break;
    case "orbit_left":
      rotX = 14;
      rotY = -15;
      break;
    case "orbit_right":
      rotX = 14;
      rotY = 14;
      break;
    case "isometric_tilt":
      rotX = 22;
      rotY = -16;
      break;
    case "top_down_overview":
      rotX = 30;
      rotY = 0;
      scale *= 0.95;
      break;
    case "steady_hold":
    default:
      rotX = 9;
      rotY = -4;
      break;
  }

  return { scale, rotX, rotY, tx, ty };
}

/* ==========================================================================
   主组件：ChoreographedScene (v4.1 可执行视觉编排引擎)
   - 通过 RendererRegistry 动态匹配并执行注册组件，严禁静默降级
   - 将 visual_world.environment 映射到真实空间透视与布光参数
   - 将 beat.yielding 交由 createYieldStyleResolver 驱动非焦点元素的透明度/景深模糊/Z轴后退
   - 将 beat.payload 直接传入注册组件控制物理参数
   - 移除画面左下角的 description 说明卡片（description 仅用于导演备注与 QA，仅 debugMode=true 时显示）
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

  // 1. 解析每个动作节拍 (Beat) 的精确起止帧窗口
  const beatWindows = beats.map((_, idx) => {
    const timed = scene.beat_timings?.[idx];
    if (timed && typeof timed.start_frame === "number" && typeof timed.end_frame === "number") {
      return { start: timed.start_frame, end: timed.end_frame };
    }
    const step = duration / Math.max(1, beats.length);
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

  const scaleSpline = hermiteSpline(keyFrames, poses.map((p) => p.scale));
  const rotXSpline = hermiteSpline(keyFrames, poses.map((p) => p.rotX));
  const rotYSpline = hermiteSpline(keyFrames, poses.map((p) => p.rotY));
  const txSpline = hermiteSpline(keyFrames, poses.map((p) => p.tx));
  const tySpline = hermiteSpline(keyFrames, poses.map((p) => p.ty));

  const camScale = scaleSpline(f);
  const camRotX = rotXSpline(f);
  const camRotY = rotYSpline(f);
  const camTx = txSpline(f);
  const camTy = tySpline(f);

  // 3. 通过 Renderer Registry 严格解析对应的动画渲染器（绝不静默降级！）
  const primaryId = normalizeObjectId(world.primary_object);
  const actionsList = beats.map((b) => b.action);
  const matchedRenderer = resolveSceneRenderer(scene.renderer_id, primaryId, actionsList);

  const getYieldStyle = createYieldStyleResolver(activeBeat, beatProgress, world.object_labels);
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

        {/* 右上角：当前动作节拍 (Beat) 与 Renderer 遥测 */}
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
          <div style={{ fontSize: 12, fontFamily: MONO, color: theme.textMuted }}>
            RENDERER: {matchedRenderer?.id || "UNREGISTERED"} · CAM:{" "}
            {(activeBeat?.camera || "steady_hold").toUpperCase()}
          </div>
        </div>
      </div>

      {/* 中央：3D 连续运镜主视口（透视距离由 environment 动态决定） */}
      <div
        style={{
          flex: 1,
          position: "relative",
          perspective: `${envConfig.perspective_px || 1800}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
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
                [RENDERER REGISTRY ERROR] 未找到匹配的动画组件
              </div>
              <div style={{ fontSize: 16 }}>
                Scene: {scene.id} | Primary Object: {primaryId} | Actions:{" "}
                {actionsList.join(", ")}
              </div>
              <div style={{ fontSize: 14, marginTop: 8, color: "#FDA4AF" }}>
                请由 Motion Designer 在 templates/src/registry/RendererRegistry.tsx 中注册支持该物体的组件。
              </div>
            </div>
          )}
        </div>

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

        {/* description 默认绝不渲染上屏！仅当显式开启 debugMode 时用于内部调试 */}
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
