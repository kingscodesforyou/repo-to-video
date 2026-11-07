import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, GlobalArtDirection, SceneArtDirection, resolveArtTheme } from "../theme";
import registryManifest from "../registry/registry_manifest.json";

/**
 * Premium Editorial Tech Explainer 空间环境与背景系统 (v4.2)：
 * 将 visual_world.environment 真正映射到对应的空间网格、地平线反射、坐标参考轴与布光系统，
 * 并接收 gridYieldStyle 响应 beat.yielding 中针对 background_grid 的结构化让位指令。
 */
export const Background: React.FC<{
  hue?: string;
  artDirection?: SceneArtDirection;
  globalArtDirection?: GlobalArtDirection;
  environment?: string;
  gridYieldStyle?: React.CSSProperties;
}> = ({
  hue,
  artDirection,
  globalArtDirection,
  environment = "minimal_physical_laboratory",
  gridYieldStyle,
}) => {
  const f = useCurrentFrame();
  const envSpec =
    (registryManifest.supported_environments as Record<string, any>)[environment] ||
    registryManifest.supported_environments.minimal_physical_laboratory;

  const effectiveArt: SceneArtDirection = {
    ...artDirection,
    theme: artDirection?.theme || envSpec.theme_default,
    accent_color: artDirection?.accent_color || hue,
  };

  const theme = resolveArtTheme(effectiveArt, globalArtDirection);
  const lighting = artDirection?.lighting || globalArtDirection?.lighting_preset || "soft_studio";
  const accent = theme.accent || COLORS.accent;
  const subtleDrift = Math.sin(f / 140) * 2.0;
  const gridSize = envSpec.grid_size || 64;

  if (theme.isLight) {
    const isDraftingTable = environment === "editorial_drafting_table";
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bgSecondary} 100%)`,
          overflow: "hidden",
        }}
      >
        {/* 柔和天光漫反射 */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 80% 60% at ${50 + subtleDrift}% 24%, ${accent}14 0%, transparent 72%)`,
          }}
        />
        {/* 制图级微细网格（受 gridYieldStyle 让位控制） */}
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${theme.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            maskImage: "radial-gradient(ellipse at center, black 45%, transparent 90%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 45%, transparent 90%)",
            ...gridYieldStyle,
          }}
        />
        {/* editorial_drafting_table 专属：四周工程十字准星与标尺刻度 */}
        {isDraftingTable && (
          <AbsoluteFill style={{ pointerEvents: "none", ...gridYieldStyle }}>
            <div
              style={{
                position: "absolute",
                inset: 28,
                border: "1px solid rgba(17, 19, 24, 0.08)",
              }}
            />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    );
  }

  const keyLightOpacity = lighting === "dramatic_rim" ? "1E" : "12";
  const isSpatialVoid = environment === "spatial_network_void";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bgSecondary} 58%, #07090D 100%)`,
        overflow: "hidden",
      }}
    >
      {/* 单一主强调色演播室主光 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 52% at ${50 + subtleDrift}% 28%, ${accent}${keyLightOpacity} 0%, transparent 70%)`,
        }}
      />

      {/* 空间环境网格层（受 gridYieldStyle 让位控制） */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          maskImage: "radial-gradient(ellipse 78% 65% at 50% 48%, black 25%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(ellipse 78% 65% at 50% 48%, black 25%, transparent 82%)",
          ...gridYieldStyle,
        }}
      />

      {/* 地平线与实验室地面反射 (horizon_line & floor_reflection) */}
      {envSpec.horizon_line && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 185,
            height: 1,
            background: `linear-gradient(90deg, transparent 5%, ${accent}38 50%, transparent 95%)`,
            ...gridYieldStyle,
          }}
        />
      )}

      {/* spatial_network_void 专属：三维正交参考坐标轴线 */}
      {isSpatialVoid && (
        <svg
          width="1920"
          height="1080"
          viewBox="0 0 1920 1080"
          style={{
            position: "absolute",
            inset: 0,
            opacity: typeof gridYieldStyle?.opacity === "number" ? gridYieldStyle.opacity * 0.16 : 0.16,
            pointerEvents: "none",
          }}
        >
          <line x1="960" y1="120" x2="960" y2="920" stroke={accent} strokeWidth="1" strokeDasharray="4 6" />
          <line x1="220" y1="540" x2="1700" y2="540" stroke={accent} strokeWidth="1" strokeDasharray="4 6" />
          <line x1="420" y1="820" x2="1500" y2="260" stroke={accent} strokeWidth="1" strokeDasharray="4 6" />
        </svg>
      )}
    </AbsoluteFill>
  );
};
