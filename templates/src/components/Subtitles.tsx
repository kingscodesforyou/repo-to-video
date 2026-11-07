import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  COLORS,
  FONT,
  GlobalArtDirection,
  SceneArtDirection,
  resolveArtTheme,
} from "../theme";

/** 计算视觉宽度：中文字符记 1，ASCII 记 0.52，避免把英文单词/技能名从中间截断 */
const visualWidth = (s: string): number => {
  let w = 0;
  for (const ch of s) {
    w += ch.charCodeAt(0) > 127 ? 1 : 0.52;
  }
  return w;
};

/** 计算口播语速权重：每个汉字记 1，每个英文词段记 1.6 */
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
  start_frame?: number;
  end_frame?: number;
  startFrame?: number;
  endFrame?: number;
}

export interface PhraseTiming {
  index: number;
  text: string;
  start_frame?: number;
  end_frame?: number;
  startFrame?: number;
  endFrame?: number;
  start_sec?: number;
  end_sec?: number;
}

/**
 * v4.2 编辑级精准字幕组件：
 * - 优先使用 tts_generator.py 生成的 WordBoundary + WAV 能量对齐锚点 (phrase_timings)
 * - 同时兼容 start_frame/end_frame 与 startFrame/endFrame
 * - 适配 dark_cinematic 与 light_editorial 双主题
 * - 零 CSS transition，保证并发渲染帧间 100% 确定性
 */
export const Subtitles: React.FC<{
  text: string;
  audioFrames: number;
  words?: WordTiming[];
  phraseTimings?: PhraseTiming[];
  artDirection?: SceneArtDirection;
  globalArtDirection?: GlobalArtDirection;
}> = ({ text, audioFrames, phraseTimings, artDirection, globalArtDirection }) => {
  const f = useCurrentFrame();
  if (!text) return null;
  if (f > audioFrames + 12) return null;

  const theme = resolveArtTheme(artDirection, globalArtDirection);

  let activeClause = "";
  if (phraseTimings && phraseTimings.length > 0) {
    activeClause = phraseTimings[phraseTimings.length - 1].text;
    for (const pt of phraseTimings) {
      const sFrame = pt.start_frame ?? pt.startFrame ?? 0;
      const eFrame = pt.end_frame ?? pt.endFrame ?? audioFrames;
      if (f >= sFrame && f < eFrame) {
        activeClause = pt.text;
        break;
      }
    }
  } else {
    const parts = splitNarration(text);
    const weights = parts.map(spokenWeight);
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    activeClause = parts[parts.length - 1];
    let acc = 0;
    for (let i = 0; i < parts.length; i++) {
      const end = acc + (weights[i] / totalWeight) * audioFrames;
      if (f < end) {
        activeClause = parts[i];
        break;
      }
      acc = end;
    }
  }

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
        bottom: 62,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 60,
        padding: "0 72px",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          background: theme.isLight
            ? "rgba(255, 255, 255, 0.94)"
            : "rgba(13, 17, 25, 0.88)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${theme.isLight ? "rgba(17,19,24,0.16)" : "rgba(255,255,255,0.14)"}`,
          borderLeft: `4px solid ${theme.accent || COLORS.accent}`,
          borderRadius: 12,
          padding: "11px 32px",
          color: theme.textPrimary,
          fontSize: 34,
          fontWeight: 700,
          fontFamily: FONT,
          letterSpacing: 0.8,
          maxWidth: 1620,
          textAlign: "center",
          boxShadow: theme.isLight
            ? "0 12px 32px rgba(17, 19, 24, 0.08)"
            : "0 14px 36px rgba(0, 0, 0, 0.55)",
          lineHeight: 1.38,
        }}
      >
        {activeClause}
      </div>
    </div>
  );
};
