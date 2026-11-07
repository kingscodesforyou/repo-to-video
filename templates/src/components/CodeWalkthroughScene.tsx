import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface CodeWalkthroughSceneProps {
  title: string;
  code: string;
  language?: string;
  filename?: string;
}

export const CodeWalkthroughScene: React.FC<CodeWalkthroughSceneProps> = ({
  title,
  code,
  language = "yaml",
  filename = "SKILL.md",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, config: { damping: 14 } });
  const lines = code.trim().split("\n");

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
      {/* 顶部标题 */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h2 style={{ fontSize: 44, color: "#f0f6fc", margin: 0, fontWeight: 700 }}>
          {title}
        </h2>
      </div>

      {/* macOS 风格代码窗口 */}
      <div
        style={{
          width: "100%",
          maxWidth: 1500,
          backgroundColor: "#161b22",
          borderRadius: 16,
          border: "1px solid #30363d",
          boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
          overflow: "hidden",
          opacity: interpolate(entrance, [0, 1], [0, 1]),
          transform: `scale(${interpolate(entrance, [0, 1], [0.96, 1])})`,
          display: "flex",
          flexDirection: "column",
          maxHeight: 640,
        }}
      >
        {/* 窗口头部红黄绿圆点 */}
        <div
          style={{
            height: 48,
            backgroundColor: "#21262d",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#ff5f56" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#ffbd2e" }} />
            <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#27c93f" }} />
          </div>
          <span style={{ color: "#8b949e", fontSize: 18, fontFamily: "'JetBrains Mono', Consolas, monospace" }}>
            {filename} ({language})
          </span>
          <div style={{ width: 50 }} />
        </div>

        {/* 代码正文区域 */}
        <div
          style={{
            padding: "24px 32px",
            overflow: "hidden",
            fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
            fontSize: 22,
            lineHeight: 1.8,
            color: "#e6edf3",
          }}
        >
          {lines.map((line, idx) => {
            const isHighlight = line.startsWith("name:") || line.startsWith("description:") || line.startsWith("##") || line.startsWith("-");
            return (
              <div key={idx} style={{ display: "flex", gap: 24 }}>
                <span
                  style={{
                    width: 40,
                    textAlign: "right",
                    color: "#484f58",
                    userSelect: "none",
                  }}
                >
                  {idx + 1}
                </span>
                <span
                  style={{
                    color: isHighlight ? "#58a6ff" : line.startsWith("#") ? "#7ee787" : "#c9d1d9",
                    fontWeight: isHighlight ? 600 : 400,
                  }}
                >
                  {line}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

