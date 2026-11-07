import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT, MONO } from "../../theme";

/**
 * GlowCard: 暗黑极简高光容器，支持边缘流光与可配置外发光
 */
export const GlowCard: React.FC<{
  children: React.ReactNode;
  glowColor?: string;
  borderColor?: string;
  style?: React.CSSProperties;
  className?: string;
}> = ({
  children,
  glowColor = COLORS.accent,
  borderColor = "rgba(148, 163, 184, 0.2)",
  style,
}) => {
  return (
    <div
      style={{
        background: "rgba(11, 16, 32, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 24,
        padding: "32px 36px",
        boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), 0 0 35px ${glowColor}18`,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* 顶部微弱高光边线 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${glowColor}aa, transparent)`,
        }}
      />
      {children}
    </div>
  );
};

/**
 * CapsuleHUD: 顶部/悬浮状态胶囊，增强科技 HUD 感
 */
export const CapsuleHUD: React.FC<{
  label: string;
  value?: string;
  statusColor?: string;
  style?: React.CSSProperties;
}> = ({ label, value, statusColor = "#22c55e", style }) => {
  const f = useCurrentFrame();
  const pulse = 1 + Math.sin(f / 8) * 0.15;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(15, 23, 42, 0.75)",
        border: "1px solid rgba(148, 163, 184, 0.28)",
        borderRadius: 999,
        padding: "8px 20px",
        fontFamily: MONO,
        fontSize: 18,
        color: COLORS.text,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: statusColor,
          transform: `scale(${pulse})`,
          boxShadow: `0 0 10px ${statusColor}`,
        }}
      />
      <span style={{ color: COLORS.sub, fontWeight: 600 }}>{label}</span>
      {value && <span style={{ color: "#fff", fontWeight: 800 }}>{value}</span>}
    </div>
  );
};

/**
 * DataFlowLine: 带有沿路径实时流动的光斑粒子管道
 */
export const DataFlowLine: React.FC<{
  active?: boolean;
  color?: string;
  speed?: number;
  width?: number | string;
  label?: string;
}> = ({
  active = true,
  color = COLORS.accent,
  speed = 1.2,
  width = "100%",
  label,
}) => {
  const f = useCurrentFrame();
  const particleOffset = ((f * speed * 3) % 100);

  return (
    <div
      style={{
        position: "relative",
        width,
        height: 28,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* 基础轨道 */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: 3,
          backgroundColor: active ? "rgba(148, 163, 184, 0.3)" : "rgba(148, 163, 184, 0.1)",
          borderRadius: 2,
        }}
      />
      {/* 流动发光粒子 */}
      {active && (
        <div
          style={{
            position: "absolute",
            left: `${particleOffset}%`,
            width: 32,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(90deg, transparent, ${color}, #ffffff)`,
            boxShadow: `0 0 14px ${color}, 0 0 28px ${color}`,
            transform: "translateX(-50%)",
          }}
        />
      )}
      {label && (
        <div
          style={{
            position: "absolute",
            top: -16,
            fontFamily: MONO,
            fontSize: 14,
            color: active ? color : COLORS.sub,
            fontWeight: 700,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

/**
 * RadarWaveRing: 环形脉冲雷达波（用于 Spotlight 与高光图元）
 */
export const RadarWaveRing: React.FC<{
  color?: string;
  size?: number;
}> = ({ color = COLORS.accent, size = 420 }) => {
  const f = useCurrentFrame();
  const wave1 = (f % 60) / 60;
  const wave2 = ((f + 30) % 60) / 60;

  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 第一圈脉冲 */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `2px solid ${color}`,
          opacity: 1 - wave1,
          transform: `scale(${interpolate(wave1, [0, 1], [0.35, 1.35])})`,
          boxShadow: `0 0 30px ${color}55`,
        }}
      />
      {/* 第二圈脉冲 */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `2px solid ${COLORS.accent2}`,
          opacity: 1 - wave2,
          transform: `scale(${interpolate(wave2, [0, 1], [0.35, 1.35])})`,
          boxShadow: `0 0 30px ${COLORS.accent2}55`,
        }}
      />
    </div>
  );
};
