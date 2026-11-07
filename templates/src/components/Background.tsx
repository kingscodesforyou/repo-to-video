import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, GlobalArtDirection, SceneArtDirection, resolveArtTheme } from "../theme";

/**
 * Premium Editorial Tech Explainer 背景系统 (v4)：
 * - 彻底移除高饱和极光渐变与彩色流光球
 * - 支持深色电影级实验室 (dark_cinematic / mechanism_3d) 与浅色理性编辑画布 (light_editorial)
 * - 单主强调色柔和演播室布光 + 建筑级精密参考网格
 */
export const Background: React.FC<{
  hue?: string;
  artDirection?: SceneArtDirection;
  globalArtDirection?: GlobalArtDirection;
  environment?: string;
}> = ({ hue, artDirection, globalArtDirection, environment }) => {
  const f = useCurrentFrame();
  const theme = resolveArtTheme(
    hue ? { ...artDirection, accent_color: artDirection?.accent_color || hue } : artDirection,
    globalArtDirection
  );

  const lighting = artDirection?.lighting || globalArtDirection?.lighting_preset || "soft_studio";
  const accent = theme.accent || COLORS.accent;
  const subtleDrift = Math.sin(f / 140) * 2.5;

  if (theme.isLight) {
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
        {/* 建筑制图级微细网格 */}
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${theme.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)`,
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at center, black 42%, transparent 88%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 42%, transparent 88%)",
          }}
        />
      </AbsoluteFill>
    );
  }

  const keyLightOpacity = lighting === "dramatic_rim" ? "1C" : "12";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bgSecondary} 58%, #080A0E 100%)`,
        overflow: "hidden",
      }}
    >
      {/* 单一主强调色工作室顶光 (克制不花哨) */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 72% 52% at ${50 + subtleDrift}% 28%, ${accent}${keyLightOpacity} 0%, transparent 70%)`,
        }}
      />

      {/* 物理实验室地平线微光与透视基准网格 */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${theme.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)`,
          backgroundSize: environment === "minimal_physical_laboratory" ? "64px 64px" : "80px 80px",
          maskImage: "radial-gradient(ellipse 78% 65% at 50% 48%, black 25%, transparent 82%)",
          WebkitMaskImage: "radial-gradient(ellipse 78% 65% at 50% 48%, black 25%, transparent 82%)",
        }}
      />
    </AbsoluteFill>
  );
};
