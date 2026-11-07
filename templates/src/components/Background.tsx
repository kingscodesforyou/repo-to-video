import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

/**
 * 鲜艳活力 3D 演播室背景：
 * 采用高饱和度宝蓝-紫罗兰-青色极光渐变底色 + 暖阳金/珊瑚粉动态流光球 + 柔和空间透视网格
 */
export const Background: React.FC<{ hue?: string }> = ({ hue = COLORS.accent }) => {
  const f = useCurrentFrame();
  const x1 = 22 + Math.sin(f / 85) * 10;
  const y1 = 26 + Math.cos(f / 95) * 8;
  const x2 = 78 + Math.cos(f / 90) * 10;
  const y2 = 68 + Math.sin(f / 75) * 9;
  const x3 = 52 + Math.sin(f / 110) * 12;
  const y3 = 18 + Math.cos(f / 100) * 7;

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, #1e1b4b 0%, #3b0764 38%, #0f4c81 74%, #065f46 100%)",
        overflow: "hidden",
      }}
    >
      {/* 鲜艳多色极光流光球 */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(circle at ${x1}% ${y1}%, rgba(56, 189, 248, 0.42) 0%, transparent 46%),
            radial-gradient(circle at ${x2}% ${y2}%, rgba(244, 114, 182, 0.38) 0%, transparent 48%),
            radial-gradient(circle at ${x3}% ${y3}%, rgba(251, 191, 36, 0.30) 0%, transparent 42%)
          `,
        }}
      />

      {/* 明亮清爽的空间网格层 */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          backgroundPosition: `0px ${(f * 0.4) % 64}px`,
          maskImage: "radial-gradient(ellipse at center, black 35%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 85%)",
        }}
      />
    </AbsoluteFill>
  );
};
