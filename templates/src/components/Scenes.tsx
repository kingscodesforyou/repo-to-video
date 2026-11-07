import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONT, MONO, tierOf } from "../theme";
import { GlowCard, CapsuleHUD, DataFlowLine, RadarWaveRing } from "./primitives/Primitives";

/* ---------- 通用动画工具 ---------- */
export const useEnter = (delay = 0, damping = 14) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping } });
};

const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0, children, style,
}) => {
  const p = useEnter(delay);
  return (
    <div style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`, ...style }}>
      {children}
    </div>
  );
};

const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "64px 110px 168px", ...style }}>
    {children}
  </AbsoluteFill>
);

const Title: React.FC<{ text: string; color?: string }> = ({ text, color = COLORS.text }) => (
  <Rise>
    <h2 style={{ fontSize: 60, fontWeight: 900, margin: "0 0 40px", color, letterSpacing: 1 }}>{text}</h2>
  </Rise>
);

export const TierBadge: React.FC<{ tier?: string; size?: number }> = ({ tier, size = 26 }) => {
  const t = tierOf(tier);
  return (
    <span style={{ background: `${t.color}22`, border: `2px solid ${t.color}`, color: t.color,
      borderRadius: 999, padding: `${size * 0.2}px ${size * 0.7}px`, fontSize: size, fontWeight: 800,
      whiteSpace: "nowrap" }}>
      {t.emoji} {t.label}
    </span>
  );
};

/* ---------- hook：开场大字 + 数据 ---------- */
export const HookScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const f = useCurrentFrame();
  const p = useEnter(0, 10);
  return (
    <Stage style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Rise><div style={{ fontSize: 30, color: COLORS.accent, fontWeight: 700, letterSpacing: 4, marginBottom: 30 }}>
        {data.kicker || "GitHub 开源推荐"}</div></Rise>
      <div style={{ transform: `scale(${interpolate(p, [0, 1], [1.3, 1])})`, opacity: p }}>
        <h1 style={{ fontSize: 104, fontWeight: 900, margin: 0, lineHeight: 1.15,
          background: `linear-gradient(120deg, #fff 20%, ${COLORS.accent} 60%, ${COLORS.accent2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {data.headline || title}
        </h1>
      </div>
      <div style={{ display: "flex", gap: 60, marginTop: 70 }}>
        {(data.stats || []).map((s: any, i: number) => {
          const sp = useEnter(15 + i * 8);
          const num = parseFloat(s.value);
          const shown = isNaN(num) ? s.value : `${Math.round(num * Math.min(1, Math.max(0, (f - 15 - i * 8) / 25)))}${String(s.value).replace(/^[\d.]+/, "")}`;
          return (
            <div key={i} style={{ opacity: sp, transform: `scale(${sp})`, background: COLORS.panel,
              border: `1px solid ${COLORS.border}`, borderRadius: 24, padding: "28px 50px", minWidth: 220 }}>
              <div style={{ fontSize: 80, fontWeight: 900, color: COLORS.accent, fontFamily: MONO }}>{shown}</div>
              <div style={{ fontSize: 28, color: COLORS.sub }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

/* ---------- points：优势卡片 ---------- */
export const PointsScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const items = data.items || [];
  return (
    <Stage>
      <Title text={title} />
      <div style={{ display: "grid", gridTemplateColumns: items.length === 4 ? "1fr 1fr" : `repeat(${Math.min(3, items.length)}, 1fr)`, gap: 32, flex: 1 }}>
        {items.map((it: any, i: number) => (
          <Rise key={i} delay={10 + i * 12} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`,
            borderRadius: 28, padding: 40, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 72 }}>{it.icon}</div>
            <div style={{ fontSize: 42, fontWeight: 800 }}>{it.title}</div>
            <div style={{ fontSize: 30, color: COLORS.sub, lineHeight: 1.6 }}>{it.desc}</div>
          </Rise>
        ))}
      </div>
    </Stage>
  );
};

/* ---------- skill_grid：技能全景 ---------- */
export const SkillGridScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const f = useCurrentFrame();
  const hl: string[] = data.highlight || [];
  let k = 0;
  return (
    <Stage>
      <Title text={title} />
      <div style={{ display: "flex", gap: 22, flex: 1, alignItems: "stretch" }}>
        {(data.categories || []).map((c: any, ci: number) => {
          const skills = c.skills || [];
          const twoCol = skills.length > 5;
          return (
            <Rise key={ci} delay={ci * 6} style={{ flex: twoCol ? 2.15 : 1, background: COLORS.panel, borderRadius: 24,
              border: `2px solid ${c.color}55`, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: c.color, marginBottom: 4 }}>{c.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr", gap: 10 }}>
                {skills.map((s: any) => {
                  const idx = k++;
                  const sp = useEnter(12 + idx * 4);
                  const on = hl.includes(s.name);
                  const pulse = on ? 1 + Math.sin(f / 6) * 0.03 : 1;
                  return (
                    <div key={s.name} style={{ opacity: sp, transform: `scale(${sp * pulse})`,
                      background: on ? `${c.color}33` : "rgba(255,255,255,0.04)", borderRadius: 14,
                      border: `1px solid ${on ? c.color : COLORS.border}`, padding: "10px 12px" }}>
                      <div style={{ fontFamily: MONO, fontSize: 17, color: COLORS.text, wordBreak: "break-all" }}>{s.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 20, color: COLORS.sub }}>{s.zh}</span>
                        {s.tier && <span style={{ fontSize: 17, color: tierOf(s.tier).color, fontWeight: 800 }}>{tierOf(s.tier).label}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Rise>
          );
        })}
      </div>
    </Stage>
  );
};

/* ---------- skill_card：单技能详解 ---------- */
export const SkillCardScene: React.FC<{ title: string; data: any }> = ({ data = {} }) => {
  const color = data.color || COLORS.accent;
  const steps: string[] = data.steps || [];
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = useEnter(0);
  return (
    <Stage style={{ flexDirection: "row", gap: 60 }}>
      {/* 左：身份卡 */}
      <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 28,
        transform: `translateX(${interpolate(p, [0, 1], [-80, 0])}px)`, opacity: p }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ fontFamily: MONO, fontSize: 30, color, fontWeight: 800 }}>
            {String(data.index ?? "").padStart(2, "0")}<span style={{ color: COLORS.sub }}> / {data.total}</span>
          </span>
          <span style={{ fontSize: 24, color, border: `1px solid ${color}`, borderRadius: 8, padding: "2px 12px" }}>{data.category}</span>
        </div>
        <div style={{ background: `linear-gradient(140deg, ${color}30, ${COLORS.panel})`, border: `2px solid ${color}88`,
          borderRadius: 32, padding: "44px 40px", boxShadow: `0 30px 80px ${color}22` }}>
          <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800, wordBreak: "break-all", lineHeight: 1.3 }}>{data.name}</div>
          <div style={{ fontSize: (data.zh || "").length > 7 ? 50 : 60, fontWeight: 900, color, margin: "18px 0 26px", lineHeight: 1.2 }}>{data.zh}</div>
          <TierBadge tier={data.tier} size={30} />
        </div>
        <Rise delay={14}>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.4 }}>“{data.one_liner}”</div>
        </Rise>
      </div>
      {/* 右：触发时机 + 步骤 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 26 }}>
        <Rise delay={18} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 24, padding: "26px 32px" }}>
          <div style={{ fontSize: 24, color: COLORS.sub, marginBottom: 8 }}>⚡ 什么时候触发</div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.5 }}>{data.trigger}</div>
        </Rise>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => {
            // 步骤随口播进度依次点亮
            const at = 30 + (i / Math.max(1, steps.length)) * Math.max(60, durationInFrames - 90);
            const sp = useEnter(Math.min(at, 24 + i * 10));
            const lit = f >= at;
            return (
              <div key={i} style={{ opacity: sp, transform: `translateX(${interpolate(sp, [0, 1], [60, 0])}px)`,
                display: "flex", alignItems: "center", gap: 22, background: lit ? `${color}22` : "rgba(255,255,255,0.03)",
                border: `1px solid ${lit ? color : COLORS.border}`, borderRadius: 18, padding: "18px 26px" }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, background: lit ? color : "#334155", color: "#0b1020",
                  fontWeight: 900, fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 32, fontWeight: 600 }}>{s}</div>
              </div>
            );
          })}
        </div>
        {data.quote && (
          <Rise delay={40} style={{ marginTop: "auto", borderLeft: `6px solid ${color}`, padding: "8px 24px",
            fontFamily: MONO, fontSize: 24, color: COLORS.sub, fontStyle: "italic", lineHeight: 1.5 }}>
            {data.quote}
          </Rise>
        )}
      </div>
    </Stage>
  );
};

/* ---------- workflow：流程链 ---------- */
export const WorkflowScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const nodes = data.nodes || [];
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const per = Math.max(12, (durationInFrames - 60) / Math.max(1, nodes.length));
  const cols = nodes.length > 5 ? Math.ceil(nodes.length / 2) : nodes.length;
  return (
    <Stage>
      <Title text={title} />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "50px 0", alignContent: "center" }}>
        {nodes.map((n: any, i: number) => {
          const at = 15 + i * per;
          const sp = useEnter(at);
          const lit = f >= at;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1, opacity: Math.max(0.25, sp), transform: `scale(${interpolate(sp, [0, 1], [0.8, 1])})`,
                background: lit ? `linear-gradient(140deg, ${COLORS.accent}33, ${COLORS.accent2}22)` : COLORS.panel,
                border: `2px solid ${lit ? COLORS.accent : COLORS.border}`, borderRadius: 22, padding: "26px 18px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, wordBreak: "break-all" }}>{n.label}</div>
                <div style={{ fontSize: 28, color: lit ? COLORS.accent : COLORS.sub, marginTop: 10, fontWeight: 700 }}>{n.sub}</div>
              </div>
              {(i + 1) % cols !== 0 && i < nodes.length - 1 && (
                <div style={{ width: 50, textAlign: "center", fontSize: 40, color: f >= at + per ? COLORS.accent : "#334155" }}>➜</div>
              )}
            </div>
          );
        })}
      </div>
      {data.caption && <Rise delay={20}><div style={{ textAlign: "center", fontSize: 32, color: COLORS.sub }}>{data.caption}</div></Rise>}
    </Stage>
  );
};

/* ---------- tier_list：推荐清单 ---------- */
export const TierListScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => (
  <Stage>
    <Title text={title} />
    <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1 }}>
      {(data.tiers || []).map((t: any, i: number) => {
        const tc = tierOf(t.tier);
        return (
          <Rise key={i} delay={10 + i * 18} style={{ display: "flex", alignItems: "stretch", background: COLORS.panel,
            border: `2px solid ${tc.color}66`, borderRadius: 24, overflow: "hidden" }}>
            <div style={{ width: 200, background: `${tc.color}33`, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 6 }}>
              <div style={{ fontSize: 52 }}>{tc.emoji}</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: tc.color }}>{t.label || tc.label}</div>
            </div>
            <div style={{ flex: 1, padding: "22px 30px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {(t.items || []).map((it: string) => (
                  <span key={it} style={{ fontFamily: MONO, fontSize: 22, background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "6px 14px" }}>{it}</span>
                ))}
              </div>
              {t.reason && <div style={{ fontSize: 26, color: COLORS.sub, marginTop: 14 }}>{t.reason}</div>}
            </div>
          </Rise>
        );
      })}
    </div>
  </Stage>
);

/* ---------- outro ---------- */
export const OutroScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const f = useCurrentFrame();
  const p = useEnter(0, 10);
  return (
    <Stage style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ transform: `scale(${p})`, opacity: p }}>
        <div style={{ fontSize: 120, fontWeight: 900, fontFamily: MONO,
          background: `linear-gradient(120deg, #fff, ${COLORS.accent}, ${COLORS.accent2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{data.headline || title}</div>
      </div>
      <Rise delay={12}><div style={{ fontSize: 44, color: COLORS.text, marginTop: 20, fontWeight: 700 }}>{data.subheadline}</div></Rise>
      {data.url && <Rise delay={22}><div style={{ marginTop: 50, fontFamily: MONO, fontSize: 36, color: COLORS.accent,
        border: `2px solid ${COLORS.accent}`, borderRadius: 16, padding: "14px 36px" }}>⭐ {data.url}</div></Rise>}
      {data.cta && <Rise delay={32}><div style={{ marginTop: 50, fontSize: 40, fontWeight: 800,
        transform: `scale(${1 + Math.sin(f / 8) * 0.04})` }}>{data.cta}</div></Rise>}
    </Stage>
  );
};

/* ---------- spotlight / hero_metric：高光大字与核心视觉聚焦 ---------- */
export const SpotlightScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const f = useCurrentFrame();
  const p = useEnter(0, 10);
  const heroText = data.hero_text || data.headline || title;
  const metrics = data.metrics || [];

  return (
    <Stage style={{ alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative" }}>
      {/* 居中扩散雷达光波 */}
      <RadarWaveRing color={COLORS.accent} size={500} />

      {/* 顶部科技 HUD 胶囊 */}
      <Rise delay={4}>
        <div style={{ marginBottom: 32 }}>
          <CapsuleHUD
            label={data.kicker || "CORE HIGHLIGHT"}
            value={data.tag || "VERIFIED"}
            statusColor={COLORS.accent}
          />
        </div>
      </Rise>

      {/* 巨大发光醒目标题 (≥160px) */}
      <div style={{ transform: `scale(${interpolate(p, [0, 1], [1.25, 1])})`, opacity: p, zIndex: 10 }}>
        <h1
          style={{
            fontSize: heroText.length > 8 ? 130 : 160,
            fontWeight: 900,
            margin: 0,
            letterSpacing: 2,
            lineHeight: 1.1,
            background: `linear-gradient(135deg, #ffffff 10%, ${COLORS.accent} 55%, ${COLORS.accent2} 90%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: `drop-shadow(0 0 35px ${COLORS.accent}88)`,
          }}
        >
          {heroText}
        </h1>
      </div>

      {data.subheadline && (
        <Rise delay={12}>
          <div
            style={{
              fontSize: 38,
              color: "#e2e8f0",
              marginTop: 28,
              fontWeight: 600,
              maxWidth: 1200,
              lineHeight: 1.4,
            }}
          >
            {data.subheadline}
          </div>
        </Rise>
      )}

      {/* 底部指标卡阵列 */}
      {metrics.length > 0 && (
        <div style={{ display: "flex", gap: 40, marginTop: 50, zIndex: 10 }}>
          {metrics.map((m: any, i: number) => {
            const sp = useEnter(16 + i * 8);
            return (
              <GlowCard
                key={i}
                glowColor={COLORS.accent2}
                style={{
                  opacity: sp,
                  transform: `scale(${sp})`,
                  minWidth: 260,
                  padding: "24px 36px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 900, color: COLORS.accent2 }}>
                  {m.value}
                </div>
                <div style={{ fontSize: 24, color: COLORS.sub, marginTop: 8, fontWeight: 600 }}>
                  {m.label}
                </div>
              </GlowCard>
            );
          })}
        </div>
      )}
    </Stage>
  );
};

/* ---------- architecture / pipeline：架构与流动数据管线 ---------- */
export const ArchitectureScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const stages: any[] = data.stages || [];
  const perStage = Math.max(15, (durationInFrames - 50) / Math.max(1, stages.length));

  return (
    <Stage>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <Title text={title} />
        {data.badge && (
          <CapsuleHUD label="PIPELINE" value={data.badge} statusColor={COLORS.accent} />
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          position: "relative",
          padding: "0 20px",
        }}
      >
        {stages.map((st, i) => {
          const at = 15 + i * perStage;
          const sp = useEnter(at);
          const isCurrentActive = f >= at && (i === stages.length - 1 || f < at + perStage);
          const isPassed = f >= at + perStage;
          const stageColor = isCurrentActive ? COLORS.accent : isPassed ? "#22c55e" : COLORS.sub;

          return (
            <React.Fragment key={i}>
              <GlowCard
                glowColor={stageColor}
                borderColor={isCurrentActive ? stageColor : "rgba(148, 163, 184, 0.18)"}
                style={{
                  flex: 1,
                  opacity: Math.max(0.3, sp),
                  transform: `scale(${isCurrentActive ? 1.05 : 1})`,
                  transition: "transform 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 14,
                  padding: "36px 20px",
                  zIndex: isCurrentActive ? 10 : 2,
                }}
              >
                <div style={{ fontSize: 54 }}>{st.icon || "⚙️"}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: isCurrentActive ? "#fff" : COLORS.text }}>
                  {st.name}
                </div>
                <div style={{ fontSize: 22, color: COLORS.sub, lineHeight: 1.4 }}>
                  {st.desc}
                </div>
                {st.tag && (
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 16,
                      background: `${stageColor}22`,
                      color: stageColor,
                      border: `1px solid ${stageColor}66`,
                      borderRadius: 999,
                      padding: "4px 12px",
                      marginTop: 4,
                    }}
                  >
                    {st.tag}
                  </span>
                )}
              </GlowCard>

              {/* 节点间的粒子流动管道 */}
              {i < stages.length - 1 && (
                <div style={{ width: 80, display: "flex", alignItems: "center" }}>
                  <DataFlowLine
                    active={f >= at}
                    color={isPassed || isCurrentActive ? COLORS.accent : "rgba(148, 163, 184, 0.4)"}
                    speed={1.5}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {data.caption && (
        <Rise delay={24}>
          <div style={{ textAlign: "center", fontSize: 28, color: COLORS.sub, marginTop: 24 }}>
            💡 {data.caption}
          </div>
        </Rise>
      )}
    </Stage>
  );
};

/* ---------- matrix_compare：多维横向对比矩阵 ---------- */
export const MatrixCompareScene: React.FC<{ title: string; data: any }> = ({ title, data = {} }) => {
  const columns: string[] = data.columns || ["传统方式", "普通代码助手", "本项目"];
  const rows: any[] = data.rows || [];
  const targetColIndex = columns.length - 1; // 默认最后一列为当前推荐项目

  return (
    <Stage>
      <Title text={title} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "rgba(11, 16, 32, 0.6)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 24,
          padding: "24px 32px",
        }}
      >
        {/* 表头 */}
        <div style={{ display: "grid", gridTemplateColumns: `2fr repeat(${columns.length}, 3fr)`, gap: 16, paddingBottom: 16, borderBottom: `2px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.sub }}>对比维度</div>
          {columns.map((c, ci) => {
            const isTarget = ci === targetColIndex;
            return (
              <div
                key={ci}
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  textAlign: "center",
                  color: isTarget ? COLORS.accent : COLORS.text,
                  background: isTarget ? `${COLORS.accent}22` : "transparent",
                  border: isTarget ? `1px solid ${COLORS.accent}77` : "none",
                  borderRadius: 12,
                  padding: "8px 12px",
                }}
              >
                {c}
              </div>
            );
          })}
        </div>

        {/* 表格行 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, justifyContent: "space-around" }}>
          {rows.map((r: any, ri: number) => {
            const sp = useEnter(8 + ri * 6);
            return (
              <div
                key={ri}
                style={{
                  opacity: sp,
                  transform: `translateX(${interpolate(sp, [0, 1], [-20, 0])}px)`,
                  display: "grid",
                  gridTemplateColumns: `2fr repeat(${columns.length}, 3fr)`,
                  gap: 16,
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: 14,
                  padding: "12px 16px",
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc" }}>{r.dimension}</div>
                {(r.values || []).map((val: string, vi: number) => {
                  const isTarget = vi === targetColIndex;
                  return (
                    <div
                      key={vi}
                      style={{
                        textAlign: "center",
                        fontSize: 24,
                        fontWeight: isTarget ? 800 : 500,
                        color: isTarget ? COLORS.accent : COLORS.sub,
                        background: isTarget ? `${COLORS.accent}18` : "transparent",
                        borderRadius: 10,
                        padding: "8px 12px",
                      }}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

