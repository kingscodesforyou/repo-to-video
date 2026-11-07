import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface TerminalSceneProps {
  title: string;
  commands: string[];
}

export const TerminalScene: React.FC<TerminalSceneProps> = ({ title, commands }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent", paddingTop: 110,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "50px 80px",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h2 style={{ fontSize: 44, color: "#f8fafc", margin: 0, fontWeight: 700 }}>
          {title}
        </h2>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 1400,
          backgroundColor: "#111827",
          borderRadius: 16,
          border: "1px solid #374151",
          boxShadow: "0 25px 50px rgba(0,0,0,0.7)",
          overflow: "hidden",
          opacity: interpolate(entrance, [0, 1], [0, 1]),
          transform: `scale(${interpolate(entrance, [0, 1], [0.96, 1])})`,
          display: "flex",
          flexDirection: "column",
          minHeight: 520,
        }}
      >
        <div
          style={{
            height: 48,
            backgroundColor: "#1f2937",
            borderBottom: "1px solid #374151",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 10,
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#ef4444" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#eab308" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#22c55e" }} />
          <span style={{ marginLeft: 20, color: "#9ca3af", fontSize: 16, fontFamily: "monospace" }}>
            bash — 1280x720
          </span>
        </div>

        <div
          style={{
            padding: "36px 40px",
            fontFamily: "'JetBrains Mono', Consolas, monospace",
            fontSize: 24,
            lineHeight: 2.2,
            color: "#e5e7eb",
          }}
        >
          {commands.map((cmd, idx) => {
            const isComment = cmd.startsWith("#");
            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {!isComment && (
                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>❯</span>
                )}
                <span
                  style={{
                    color: isComment ? "#6b7280" : "#f9fafb",
                    fontStyle: isComment ? "italic" : "normal",
                  }}
                >
                  {cmd}
                </span>
              </div>
            );
          })}
          {/* 闪烁的光标 */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>❯</span>
            <div
              style={{
                width: 12,
                height: 24,
                backgroundColor: frame % 30 < 15 ? "#38bdf8" : "transparent",
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

