import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONT } from "../theme";

/** 计算视觉宽度：中文字符记 1，ASCII 记 0.52，避免把英文单词/技能名从中间截断 */
const visualWidth = (s: string): number => {
  let w = 0;
  for (const ch of s) {
    w += ch.charCodeAt(0) > 127 ? 1 : 0.52;
  }
  return w;
};

/** 计算口播语速权重：每个汉字记 1，每个英文词段（连字符拆开）记 1.6 */
const spokenWeight = (s: string): number => {
  const englishTokens = s.match(/[A-Za-z0-9]+/g) || [];
  const cjkChars = s.replace(/[A-Za-z0-9\s\p{P}]/gu, "");
  return Math.max(1, cjkChars.length + englishTokens.length * 1.6);
};

/** 按标点切分短句，保护英文单词与连字符技能名不被截断 */
export const splitNarration = (text: string, maxVisual = 28): string[] => {
  const clauses = text
    .split(/(?<=[，。！？；：、,.!?;:])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) {
      out.push(buf.trim().replace(/[，。；：、,;:]$/, ""));
      buf = "";
    }
  };

  for (const clause of clauses) {
    if (!buf) {
      if (visualWidth(clause) <= maxVisual) {
        buf = clause;
      } else {
        const tokens = clause.match(/[A-Za-z0-9_.-]+|\s+|./g) || [clause];
        for (const tk of tokens) {
          if (visualWidth(buf + tk) > maxVisual && buf.trim()) {
            flush();
          }
          buf += tk;
        }
        flush();
      }
    } else if (visualWidth(buf + clause) <= maxVisual) {
      buf += clause;
    } else {
      flush();
      buf = clause;
    }
  }
  flush();
  return out;
};

export interface WordTiming {
  word: string;
  startFrame?: number;
  endFrame?: number;
}

/**
 * 稳定无频闪字幕组件：
 * - 移除逐字跳动的发光胶囊、字重切换与缩放动画（彻底消除字幕闪烁与排版抖动）
 * - 移除所有 CSS transition（保证 Remotion 多进程并发渲染帧间 100% 确定性）
 * - 采用稳重大气的整句清晰呈现
 */
export const Subtitles: React.FC<{
  text: string;
  audioFrames: number;
  words?: WordTiming[];
}> = ({ text, audioFrames }) => {
  const f = useCurrentFrame();
  if (!text) return null;
  if (f > audioFrames + 12) return null;

  const parts = splitNarration(text);
  const weights = parts.map(spokenWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  let activeClause = parts[parts.length - 1];
  let acc = 0;
  for (let i = 0; i < parts.length; i++) {
    const end = acc + (weights[i] / totalWeight) * audioFrames;
    if (f < end) {
      activeClause = parts[i];
      break;
    }
    acc = end;
  }

  // 仅在整幕刚进场和即将结束时做柔和透明度过渡，句间切换平稳不闪烁
  const sceneOpacity = interpolate(
    f,
    [0, 5, Math.max(6, audioFrames - 4), audioFrames + 10],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 60,
        padding: "0 60px",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1.5px solid ${COLORS.accent}66`,
          borderRadius: 18,
          padding: "12px 34px",
          color: "#ffffff",
          fontSize: 38,
          fontWeight: 800,
          fontFamily: FONT,
          letterSpacing: 1.2,
          textShadow: "0 2px 10px rgba(0,0,0,0.65)",
          maxWidth: 1680,
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(15, 23, 42, 0.45)",
          lineHeight: 1.35,
        }}
      >
        {activeClause}
      </div>
    </div>
  );
};
