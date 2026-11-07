import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT, MONO } from "../theme";

export interface ChapterSpan { name: string; start: number; end: number }

/** 底部章节实时进度条（贴合 B站/YouTube 底部拖拽空降习惯） */
export const ChapterBar: React.FC<{ chapters: ChapterSpan[]; total: number; repoName: string }> = ({
  chapters, total, repoName,
}) => {
  const f = useCurrentFrame();
  if (!chapters.length) return null;
  const fmt = (frames: number) =>
    `${Math.floor(frames / 30 / 60)}:${String(Math.floor(frames / 30) % 60).padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 54,
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        gap: 18,
        fontFamily: FONT,
        zIndex: 70,
        background: "linear-gradient(0deg, rgba(7,11,20,0.95) 60%, rgba(7,11,20,0.6) 100%)",
        borderTop: "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div
        style={{
          color: COLORS.accent,
          fontWeight: 800,
          fontSize: 18,
          fontFamily: MONO,
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
        }}
      >
        {repoName}
      </div>

      <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", height: "100%" }}>
        {chapters.map((c, idx) => {
          const active = f >= c.start && f < c.end;
          const done = f >= c.end;
          const p = active ? (f - c.start) / Math.max(1, c.end - c.start) : done ? 1 : 0;
          return (
            <div
              key={c.name}
              style={{
                flex: Math.max(950, c.end - c.start),
                minWidth: 120,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 5,
              }}
            >
              {/* 分段进度槽（居上，贴近画面底边） */}
              <div
                style={{
                  height: active ? 6 : 4,
                  borderRadius: 3,
                  background: "rgba(148,163,184,0.22)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    width: `${p * 100}%`,
                    background: active
                      ? `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`
                      : COLORS.accent,
                    boxShadow: active ? `0 0 10px ${COLORS.accent}` : "none",
                  }}
                />
              </div>

              {/* 章节名 + 起始时间点（方便观众对着进度条跳转） */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  color: active ? "#ffffff" : done ? "#cbd5e1" : COLORS.sub,
                  fontWeight: active ? 800 : 500,
                }}
              >
                <span>
                  {idx + 1}.{c.name}
                </span>
                <span style={{ fontSize: 12, fontFamily: MONO, opacity: 0.7 }}>
                  ({fmt(c.start)})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          color: COLORS.sub,
          fontSize: 15,
          fontFamily: MONO,
          whiteSpace: "nowrap",
        }}
      >
        {fmt(f)} / {fmt(total)}
      </div>
    </div>
  );
};
