import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface BeforeAfterSceneProps {
  title: string;
  before_title?: string;
  before_text?: string;
  after_title?: string;
  after_text?: string;
}

export const BeforeAfterScene: React.FC<BeforeAfterSceneProps> = ({
  title,
  before_title = "普通 AI 模式",
  before_text = "❌ 随意修改代码\n❌ 产生幻觉与越权\n❌ 缺乏测试与验证",
  after_title = "搭载本 Skill 模式",
  after_text = "✅ 遵循测试驱动开发\n✅ 系统化根因排查\n✅ 执行前后完整验证",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 14 } });
  const cardLeftProgress = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  const cardRightProgress = spring({ frame: frame - 12, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "transparent", paddingTop: 110,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 80px",
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
      }}
    >
      {/* 顶部标题 */}
      <div
        style={{
          opacity: interpolate(titleProgress, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleProgress, [0, 1], [-20, 0])}px)`,
          textAlign: "center",
          marginBottom: 50,
        }}
      >
        <span
          style={{
            fontSize: 20,
            textTransform: "uppercase",
            letterSpacing: 3,
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          COMPARISON
        </span>
        <h2
          style={{
            fontSize: 48,
            color: "#f8fafc",
            margin: "8px 0 0 0",
            fontWeight: 800,
          }}
        >
          {title}
        </h2>
      </div>

      {/* 双栏对比区域 */}
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 1600,
          gap: 40,
          height: 580,
        }}
      >
        {/* 左栏：痛点/原生对比 */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#161b26",
            borderRadius: 24,
            border: "2px solid #ef444455",
            boxShadow: "0 20px 40px rgba(239, 68, 68, 0.08)",
            padding: 40,
            display: "flex",
            flexDirection: "column",
            opacity: interpolate(cardLeftProgress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(cardLeftProgress, [0, 1], [30, 0])}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 30,
              paddingBottom: 20,
              borderBottom: "1px solid #334155",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: "#ef4444",
                boxShadow: "0 0 12px #ef4444",
              }}
            />
            <h3 style={{ fontSize: 32, color: "#f87171", margin: 0, fontWeight: 700 }}>
              {before_title}
            </h3>
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 2.1,
              color: "#cbd5e1",
              whiteSpace: "pre-line",
              fontFamily: "'JetBrains Mono', Consolas, monospace",
            }}
          >
            {before_text}
          </div>
        </div>

        {/* 右栏：搭载 Skill 后的专业表现 */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#161b26",
            borderRadius: 24,
            border: "2px solid #22c55e88",
            boxShadow: "0 20px 50px rgba(34, 197, 94, 0.12)",
            padding: 40,
            display: "flex",
            flexDirection: "column",
            opacity: interpolate(cardRightProgress, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(cardRightProgress, [0, 1], [30, 0])}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 30,
              paddingBottom: 20,
              borderBottom: "1px solid #334155",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 12px #22c55e",
              }}
            />
            <h3 style={{ fontSize: 32, color: "#4ade80", margin: 0, fontWeight: 700 }}>
              {after_title}
            </h3>
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 2.1,
              color: "#f1f5f9",
              whiteSpace: "pre-line",
              fontFamily: "'JetBrains Mono', Consolas, monospace",
            }}
          >
            {after_text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

