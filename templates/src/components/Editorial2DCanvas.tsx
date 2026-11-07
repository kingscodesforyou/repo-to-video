import React from "react";
import { interpolate } from "remotion";
import { FONT, MONO, ResolvedTheme } from "../theme";
import {
  MotionStateResolver,
  motionAttributes,
} from "../registry/MotionPrimitives";
import {
  ChoreographyBeat,
  VisualWorldSpec,
  normalizeObjectId,
  normalizeObjectLabel,
} from "../registry/RendererRegistry";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export interface Editorial2DStageProps {
  f: number;
  fps: number;
  duration: number;
  theme: ResolvedTheme;
  material: string;
  world: VisualWorldSpec;
  beats: ChoreographyBeat[];
  beatWindows: Array<{ start: number; end: number }>;
  activeBeatIdx: number;
  activeBeat: ChoreographyBeat;
  beatProgress: number;
  getYieldStyle: (objectId: string, objectLabel?: string) => React.CSSProperties;
  getMotionState: MotionStateResolver;
}

/**
 * 保证 2D 让位样式绝不包含任何 3D 变换 (rotateX/Y/Z, translateZ, perspective)
 */
function sanitize2DYieldStyle(style: React.CSSProperties): React.CSSProperties {
  const clean: React.CSSProperties = { ...style };
  if (typeof clean.transform === "string") {
    const scaleMatch = clean.transform.match(/scale\([^)]+\)/);
    clean.transform = scaleMatch ? scaleMatch[0] : undefined;
  }
  return clean;
}

/**
 * v4.4 独立 2D 平面教学渲染器 (Editorial2DRenderer / editorial_2d_v1)
 * 严格遵循 2D 镜头铁律：
 * - 正交平面构图 (perspective: none, transformStyle: flat)
 * - 零三维倾斜 (无 rotateX / rotateY / rotateZ / translateZ)
 * - 文字、代码、流程图、对比表、因果图始终保持 100% 水平与锐利
 * - 支持 8 类教学动作：typography, infographic, flowchart, timeline, comparison, code_explanation, step_by_step, cause_effect
 */
export const Editorial2DRenderer: React.FC<Editorial2DStageProps> = ({
  f,
  theme,
  world,
  activeBeatIdx,
  activeBeat,
  beatProgress,
  getYieldStyle,
  getMotionState,
}) => {
  const labels = world.object_labels || {};
  const payload = activeBeat.payload || {};
  const action = activeBeat.action || "typography";
  const primaryId = normalizeObjectId(world.primary_object) || "concept_card_2d";
  const primaryLabel = normalizeObjectLabel(world.primary_object, labels);
  const primaryState = getMotionState({ objectId: primaryId });
  const primaryYield = sanitize2DYieldStyle(getYieldStyle(primaryId, primaryLabel));

  const revealT = interpolate(beatProgress, [0, 0.45], [0, 1], clamp);
  const slideUp = interpolate(revealT, [0, 1], [14, 0], clamp);

  const cardSurface: React.CSSProperties = {
    background: theme.isLight ? "#FFFFFF" : "#111622",
    border: `1.5px solid ${theme.accent}66`,
    boxShadow: theme.isLight
      ? "0 16px 36px rgba(15, 23, 42, 0.07)"
      : "0 18px 42px rgba(0, 0, 0, 0.48)",
    borderRadius: 20,
  };

  const secondarySurface: React.CSSProperties = {
    background: theme.isLight ? "#F8FAFC" : "#161D2B",
    border: `1px solid ${theme.borderStrong}`,
    borderRadius: 16,
  };

  // 1. 代码逐行精讲模式 (code_explanation / highlight_code)
  if (
    action === "code_explanation" ||
    action === "highlight_code" ||
    primaryId === "code_explainer_2d"
  ) {
    const assets = world.authentic_assets || {};
    const rawCode =
      assets.code_snippet ||
      `def distill_memory(raw_messages: list[str]) -> list[dict]:\n    valid_signals = [m for m in raw_messages if not is_noise(m)]\n    vectors = embed_signals(valid_signals)\n    return commit_to_ledger(vectors)`;
    const codeLines = rawCode.replace(/\r\n/g, "\n").split("\n");
    const highlightLines: number[] = Array.isArray(payload.lines)
      ? payload.lines
      : assets.highlight_lines || [1, 2];
    const teacherNotes: string[] = Array.isArray(payload.steps)
      ? payload.steps
      : Array.isArray(payload.key_points)
      ? payload.key_points
      : [
          payload.annotation || "第 1 步：接收原始输入列表，准备逐条筛查",
          "第 2 步：剔除寒暄噪音，只保留有价值的信号",
          "第 3 步：将有效信号转化为可检索的结构化记录",
        ];
    const stepObjId =
      normalizeObjectId(world.secondary_objects?.[0]) || "step_board_2d";
    const stepState = getMotionState({ objectId: stepObjId });
    const stepYield = sanitize2DYieldStyle(
      getYieldStyle(stepObjId, normalizeObjectLabel(stepObjId, labels))
    );

    return (
      <div
        data-visual-mode="2d_editorial"
        data-planar="true"
        style={{
          position: "relative",
          width: 1560,
          height: 640,
          display: "flex",
          gap: 28,
          alignItems: "stretch",
          fontFamily: FONT,
        }}
      >
        {/* 左侧：100% 正视零倾斜代码教学视口 */}
        <div
          {...motionAttributes(primaryId, primaryState)}
          style={{
            flex: 1.35,
            ...cardSurface,
            ...primaryYield,
            background: "#0D1117",
            border: `1.5px solid ${theme.accent}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 48,
              background: "#161B22",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 22px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: `${theme.accent}24`,
                  color: theme.accent,
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                2D ORTHOGRAPHIC CODE VIEW
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#E6EDF3",
                }}
              >
                {assets.filename || primaryLabel}
              </span>
            </div>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: "#34D399",
                fontWeight: 700,
              }}
            >
              LINES FOCUSED: {highlightLines.join(", ")}
            </span>
          </div>

          <div
            style={{
              flex: 1,
              padding: "22px 26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              fontFamily: MONO,
              fontSize: 19,
              lineHeight: 1.65,
            }}
          >
            {codeLines.slice(0, 12).map((line, idx) => {
              const lineNumber = idx + 1;
              const isFocused = highlightLines.includes(lineNumber);
              return (
                <div
                  key={lineNumber}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "4px 14px",
                    borderRadius: 8,
                    background: isFocused
                      ? `${theme.accent}26`
                      : "rgba(255,255,255,0.01)",
                    borderLeft: isFocused
                      ? `4px solid ${theme.accent}`
                      : "4px solid transparent",
                    opacity: isFocused ? 1 : 0.34,
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      color: isFocused ? theme.accent : "#6E7681",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {String(lineNumber).padStart(2, "0")}
                  </span>
                  <span style={{ color: "#F0F6FC", whiteSpace: "pre" }}>
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：特级教师白话逐行拆解板 */}
        <div
          {...motionAttributes(stepObjId, stepState)}
          style={{
            flex: 1,
            ...cardSurface,
            ...stepYield,
            padding: "26px 28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: 1.2,
              }}
            >
              STEP-BY-STEP CODE WALKTHROUGH // 逐行白话精讲
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 6,
              }}
            >
              {payload.headline ||
                normalizeObjectLabel(stepObjId, labels) ||
                "代码背后的执行逻辑"}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {teacherNotes.slice(0, 4).map((note, idx) => {
              const isCurrent =
                idx ===
                (typeof payload.active_step === "number"
                  ? payload.active_step
                  : activeBeatIdx % teacherNotes.length);
              return (
                <div
                  key={idx}
                  style={{
                    ...secondarySurface,
                    padding: "16px 20px",
                    borderLeft: `4px solid ${
                      isCurrent ? theme.accent : theme.borderStrong
                    }`,
                    background: isCurrent
                      ? `${theme.accent}15`
                      : secondarySurface.background,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                  }}
                >
                  <span
                    style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isCurrent ? theme.accent : theme.border,
                      color: isCurrent ? "#0B0D12" : theme.textSecondary,
                      fontFamily: MONO,
                      fontWeight: 800,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: isCurrent ? 700 : 500,
                      color: theme.textPrimary,
                      lineHeight: 1.45,
                    }}
                  >
                    {note}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: `${theme.accent}12`,
              border: `1px solid ${theme.accent}44`,
              fontSize: 15,
              fontWeight: 600,
              color: theme.textSecondary,
            }}
          >
            {payload.annotation ||
              payload.subheadline ||
              "正视平面排布：左侧真实源码行号与右侧白话原理解释一一对应"}
          </div>
        </div>
      </div>
    );
  }

  // 2. 2D 流程图模式 (flowchart)
  if (action === "flowchart" || primaryId === "flowchart_canvas_2d") {
    const flowNodes: string[] = Array.isArray(payload.nodes)
      ? payload.nodes
      : [
          "1. 接收原始问题",
          "2. 拆解关键意图",
          "3. 检索匹配知识",
          "4. 生成清晰回答",
        ];
    const flowEdges: string[] = Array.isArray(payload.edges)
      ? payload.edges
      : ["结构化解析", "按需匹配", "汇总验证"];
    const activeNodeIdx =
      typeof payload.active_step === "number"
        ? payload.active_step
        : Math.min(
            flowNodes.length - 1,
            Math.floor(beatProgress * flowNodes.length)
          );

    return (
      <div
        data-visual-mode="2d_editorial"
        data-planar="true"
        {...motionAttributes(primaryId, primaryState)}
        style={{
          position: "relative",
          width: 1560,
          height: 640,
          ...cardSurface,
          ...primaryYield,
          padding: "36px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: 1.4,
              }}
            >
              2D ORTHOGRAPHIC FLOWCHART // 平面正交教学流程图
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 6,
              }}
            >
              {payload.headline || primaryLabel}
            </div>
          </div>
          <div
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              background: `${theme.accent}1A`,
              border: `1px solid ${theme.accent}`,
              fontFamily: MONO,
              fontSize: 13,
              fontWeight: 700,
              color: theme.accent,
            }}
          >
            STAGE {activeNodeIdx + 1} OF {flowNodes.length}
          </div>
        </div>

        {/* 水平正交节点与 SVG 矢量连接线 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            margin: "24px 0",
          }}
        >
          {flowNodes.slice(0, 5).map((nodeText, idx) => {
            const reached = idx <= activeNodeIdx;
            const isCurrent = idx === activeNodeIdx;
            return (
              <React.Fragment key={idx}>
                <div
                  style={{
                    flex: 1,
                    minHeight: 190,
                    borderRadius: 18,
                    padding: "22px 20px",
                    background: isCurrent
                      ? `${theme.accent}1E`
                      : reached
                      ? secondarySurface.background
                      : "transparent",
                    border: `2px solid ${
                      isCurrent
                        ? theme.accent
                        : reached
                        ? `${theme.accent}66`
                        : theme.borderStrong
                    }`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transform: `translateY(${isCurrent ? -4 : 0}px)`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 13,
                        fontWeight: 800,
                        color: reached ? theme.accent : theme.textMuted,
                      }}
                    >
                      STEP 0{idx + 1}
                    </span>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: reached ? theme.accent : theme.borderStrong,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: theme.textPrimary,
                      lineHeight: 1.35,
                    }}
                  >
                    {nodeText}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: MONO,
                      color: isCurrent ? theme.accent : theme.textSecondary,
                    }}
                  >
                    {isCurrent
                      ? "● 当前执行阶段"
                      : reached
                      ? "✓ 已完成处理"
                      : "○ 待流转"}
                  </div>
                </div>

                {idx < Math.min(4, flowNodes.length - 1) && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      minWidth: 84,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: MONO,
                        color: theme.textSecondary,
                        marginBottom: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {flowEdges[idx] || "流转"}
                    </span>
                    <svg width="76" height="24" viewBox="0 0 76 24">
                      <line
                        x1="2"
                        y1="12"
                        x2="62"
                        y2="12"
                        stroke={
                          idx < activeNodeIdx ? theme.accent : theme.borderStrong
                        }
                        strokeWidth="3"
                      />
                      <polygon
                        points="60,5 74,12 60,19"
                        fill={
                          idx < activeNodeIdx ? theme.accent : theme.borderStrong
                        }
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            ...secondarySurface,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.textPrimary,
            }}
          >
            {payload.subheadline ||
              payload.annotation ||
              "数据从左至右依次经过清晰的步骤处理，每一步的输入与输出一目了然"}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 13,
              color: theme.accent,
              fontWeight: 700,
            }}
          >
            PLANAR FLOW // ZERO TILT
          </span>
        </div>
      </div>
    );
  }

  // 3. 前后对比模式 (comparison / compare_split)
  if (
    action === "comparison" ||
    action === "compare_split" ||
    primaryId === "comparison_matrix_2d"
  ) {
    const beforeLabel = payload.before_label || "改造前：传统做法的痛点";
    const afterLabel = payload.after_label || "改造后：本项目的高效做法";
    const beforeItems: string[] = Array.isArray(payload.before_items)
      ? payload.before_items
      : [
          "把所有历史文字全部塞给模型，耗时又费钱",
          "关键信息被淹没在大量闲聊噪音中",
          "出了问题无法追溯到底是哪一步出错",
        ];
    const afterItems: string[] = Array.isArray(payload.after_items)
      ? payload.after_items
      : [
          "先过滤提纯，只挑出真正有用的关键记忆",
          "按需精准检索，响应速度提升数倍",
          "每条结论都有清晰的时间与来源记录",
        ];

    return (
      <div
        data-visual-mode="2d_editorial"
        data-planar="true"
        {...motionAttributes(primaryId, primaryState)}
        style={{
          position: "relative",
          width: 1560,
          height: 640,
          display: "flex",
          gap: 32,
          alignItems: "stretch",
          fontFamily: FONT,
          ...primaryYield,
        }}
      >
        <div
          style={{
            flex: 1,
            ...cardSurface,
            border: "1.5px solid rgba(244, 63, 94, 0.55)",
            padding: "32px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                fontWeight: 800,
                color: "#F43F5E",
              }}
            >
              BEFORE // 传统痛点对比
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 8,
              }}
            >
              {beforeLabel}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {beforeItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  ...secondarySurface,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 19,
                  color: theme.textSecondary,
                }}
              >
                <span style={{ color: "#F43F5E", fontWeight: 900 }}>✕</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 14,
              fontFamily: MONO,
              color: "#F43F5E",
              fontWeight: 700,
            }}
          >
            STATUS: HIGH COGNITIVE & COMPUTE OVERHEAD
          </div>
        </div>

        <div
          style={{
            flex: 1.08,
            ...cardSurface,
            border: `2px solid ${theme.accent}`,
            padding: "32px 36px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                fontWeight: 800,
                color: theme.accent,
              }}
            >
              AFTER // 核心改进方案
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 8,
              }}
            >
              {afterLabel}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {afterItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  ...secondarySurface,
                  background: `${theme.accent}14`,
                  border: `1px solid ${theme.accent}55`,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 19,
                  fontWeight: 700,
                  color: theme.textPrimary,
                }}
              >
                <span style={{ color: theme.accent, fontWeight: 900 }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 14,
              fontFamily: MONO,
              color: theme.accent,
              fontWeight: 700,
            }}
          >
            STATUS: VERIFIED IMPROVEMENT
          </div>
        </div>
      </div>
    );
  }

  // 4. 因果关系推导模式 (cause_effect)
  if (action === "cause_effect" || primaryId === "cause_effect_diagram_2d") {
    const causeLabel = payload.cause_label || "问题根源：输入信息杂乱无章";
    const mechanismLabel =
      payload.mechanism_label ||
      payload.headline ||
      "核心机制：先分流提纯，再建立结构化索引";
    const effectLabel = payload.effect_label || "最终效果：毫秒级精准回答";
    const notes: string[] = Array.isArray(payload.key_points)
      ? payload.key_points
      : [
          "输入端：识别真正有用的事实，丢弃无意义寒暄",
          "处理端：像图书馆分门别类编目一样建立索引",
          "输出端：只取所需卡片，既快又准",
        ];

    return (
      <div
        data-visual-mode="2d_editorial"
        data-planar="true"
        {...motionAttributes(primaryId, primaryState)}
        style={{
          position: "relative",
          width: 1560,
          height: 640,
          ...cardSurface,
          ...primaryYield,
          padding: "36px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontFamily: MONO,
            fontWeight: 700,
            color: theme.accent,
          }}
        >
          2D CAUSE & EFFECT DERIVATION // 因果推导教学图解
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div
            style={{
              flex: 1,
              ...secondarySurface,
              padding: "28px 26px",
              borderTop: "4px solid #F59E0B",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                color: "#F59E0B",
                fontWeight: 800,
              }}
            >
              01 / CAUSE (为什么会出问题)
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 12,
              }}
            >
              {causeLabel}
            </div>
          </div>

          <svg width="64" height="28" viewBox="0 0 64 28">
            <line
              x1="0"
              y1="14"
              x2="50"
              y2="14"
              stroke={theme.accent}
              strokeWidth="3"
            />
            <polygon points="48,6 62,14 48,22" fill={theme.accent} />
          </svg>

          <div
            style={{
              flex: 1.2,
              ...secondarySurface,
              background: `${theme.accent}18`,
              border: `2px solid ${theme.accent}`,
              padding: "28px 26px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                color: theme.accent,
                fontWeight: 800,
              }}
            >
              02 / MECHANISM (核心设计原理)
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 12,
              }}
            >
              {mechanismLabel}
            </div>
          </div>

          <svg width="64" height="28" viewBox="0 0 64 28">
            <line
              x1="0"
              y1="14"
              x2="50"
              y2="14"
              stroke="#34D399"
              strokeWidth="3"
            />
            <polygon points="48,6 62,14 48,22" fill="#34D399" />
          </svg>

          <div
            style={{
              flex: 1,
              ...secondarySurface,
              padding: "28px 26px",
              borderTop: "4px solid #34D399",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontFamily: MONO,
                color: "#34D399",
                fontWeight: 800,
              }}
            >
              03 / EFFECT (带来的直接收益)
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: theme.textPrimary,
                marginTop: 12,
              }}
            >
              {effectLabel}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {notes.slice(0, 3).map((pt, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                ...secondarySurface,
                padding: "16px 20px",
                fontSize: 17,
                fontWeight: 600,
                color: theme.textSecondary,
              }}
            >
              {pt}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. 步骤拆解 / 时间线 / 信息图 / 核心概念解释 (step_by_step, timeline, infographic, typography)
  const items: string[] = Array.isArray(payload.steps)
    ? payload.steps
    : Array.isArray(payload.key_points)
    ? payload.key_points
    : Array.isArray(payload.timestamps)
    ? payload.timestamps
    : [
        "生活类比：就像图书馆管理员帮你把杂乱笔记整理成索引卡片",
        "核心概念：它不是把所有对话硬塞给模型，而是先提炼再存起来",
        "类比边界：真实系统还会自动计算语义相似度，比纸质卡片快上万倍",
      ];

  const headline =
    payload.headline || primaryLabel || "从生活常识看懂核心技术原理";
  const subheadline =
    payload.subheadline ||
    payload.annotation ||
    "先用大白话讲清它解决什么问题，再一步步拆解内部工作过程";

  return (
    <div
      data-visual-mode="2d_editorial"
      data-planar="true"
      {...motionAttributes(primaryId, primaryState)}
      style={{
        position: "relative",
        width: 1560,
        height: 640,
        ...cardSurface,
        ...primaryYield,
        padding: "40px 48px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: FONT,
        transform: `translateY(${slideUp.toFixed(1)}px)`,
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontFamily: MONO,
              fontWeight: 800,
              color: theme.accent,
              letterSpacing: 1.4,
            }}
          >
            2D EDITORIAL PEDAGOGY // {action.toUpperCase()}
          </span>
          {payload.metric_value !== undefined && (
            <span
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                background: `${theme.accent}20`,
                color: theme.accent,
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              {payload.metric_value} {payload.metric_unit || ""}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            color: theme.textPrimary,
            marginTop: 12,
            letterSpacing: -0.6,
            lineHeight: 1.2,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            fontSize: 21,
            fontWeight: 500,
            color: theme.textSecondary,
            marginTop: 10,
          }}
        >
          {subheadline}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(3, items.length)}, 1fr)`,
          gap: 22,
        }}
      >
        {items.slice(0, 3).map((item, idx) => {
          const active =
            typeof payload.active_step === "number"
              ? payload.active_step === idx
              : idx === activeBeatIdx % Math.max(1, Math.min(3, items.length));
          return (
            <div
              key={idx}
              style={{
                ...secondarySurface,
                padding: "24px 26px",
                borderTop: `4px solid ${
                  active ? theme.accent : theme.borderStrong
                }`,
                background: active
                  ? `${theme.accent}14`
                  : secondarySurface.background,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 210,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 13,
                  fontWeight: 800,
                  color: active ? theme.accent : theme.textMuted,
                }}
              >
                KEY POINT 0{idx + 1}
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  color: theme.textPrimary,
                  lineHeight: 1.45,
                  margin: "12px 0",
                }}
              >
                {item}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: MONO,
                  color: active ? theme.accent : theme.textSecondary,
                }}
              >
                {active ? "● 当前讲解焦点" : "✓ 平面正视卡片"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
