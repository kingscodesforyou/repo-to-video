import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface TitleCardProps {
  title: string;
  headline?: string;
  subheadline?: string;
  tag?: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  headline,
  subheadline,
  tag = "GitHub 开源推荐",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#090d16",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
        padding: "0 80px",
      }}
    >
      {/* 渐变流光背景球 */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56,189,248,0.18) 0%, rgba(99,102,241,0.08) 50%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 1400,
          zIndex: 1,
        }}
      >
        {/* 标签 */}
        <div
          style={{
            padding: "8px 24px",
            background: "linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(99,102,241,0.2) 100%)",
            border: "1px solid rgba(56,189,248,0.4)",
            borderRadius: 30,
            color: "#38bdf8",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2,
            marginBottom: 36,
          }}
        >
          {tag}
        </div>

        {/* 标题 */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 800,
            margin: "0 0 24px 0",
            background: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-1px",
            lineHeight: 1.15,
          }}
        >
          {headline || title}
        </h1>

        {/* 副标题 */}
        {subheadline && (
          <p
            style={{
              fontSize: 32,
              color: "#94a3b8",
              margin: 0,
              lineHeight: 1.5,
              maxWidth: 1100,
            }}
          >
            {subheadline}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};
