import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, MONO } from "../theme";

/* ==========================================================================
   通用 3D 数学、Hermite 样条相机与投影工具 (video-shotcraft 核心配方)
   ========================================================================== */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 单调三次 Hermite 样条插值：保证多关键帧 3D 相机运镜速度连续、无顿挫 */
const hermiteSpline = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / Math.max(1e-5, xs[i + 1] - x));
  const m = xs.map((_, i) =>
    i === 0 ? d[0] : i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  );
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = Math.max(1e-5, xs[i + 1] - xs[i]);
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
};

/** 顶栏标题 + 特级教师秒懂副标题 */
const PedagogicalHeader: React.FC<{
  title: string;
  badge?: string;
  analogySubtitle?: string;
  accentColor?: string;
  phaseBadge?: string;
}> = ({
  title,
  badge = "特级教师 3D 拆解",
  analogySubtitle,
  accentColor = COLORS.accent,
  phaseBadge,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 16, stiffness: 120 } });

  return (
    <div
      style={{
        position: "relative",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 14,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [-20, 0])}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              background: `linear-gradient(135deg, ${accentColor}44, ${COLORS.accent2}44)`,
              border: `2px solid ${accentColor}`,
              color: "#ffffff",
              borderRadius: 999,
              padding: "5px 18px",
              fontSize: 21,
              fontWeight: 900,
              letterSpacing: 1.2,
              boxShadow: `0 0 22px ${accentColor}55`,
            }}
          >
            🎓 {badge}
          </span>
          <h2
            style={{
              fontSize: 48,
              fontWeight: 900,
              margin: 0,
              color: "#ffffff",
              letterSpacing: 1,
              textShadow: "0 4px 18px rgba(0,0,0,0.5)",
            }}
          >
            {title}
          </h2>
        </div>

        {phaseBadge && (
          <span
            style={{
              background: "rgba(251, 191, 36, 0.22)",
              border: "2px solid #fbbf24",
              color: "#fef08a",
              borderRadius: 999,
              padding: "6px 18px",
              fontSize: 20,
              fontWeight: 900,
              boxShadow: "0 0 20px rgba(251, 191, 36, 0.35)",
            }}
          >
            🎬 {phaseBadge}
          </span>
        )}
      </div>

      {analogySubtitle && (
        <div
          style={{
            fontSize: 24,
            color: "#fef3c7",
            fontWeight: 700,
            paddingLeft: 6,
            display: "flex",
            alignItems: "center",
            gap: 10,
            textShadow: "0 2px 8px rgba(0,0,0,0.45)",
          }}
        >
          <span style={{ color: "#fbbf24", fontWeight: 900 }}>💡 一句话秒懂：</span>
          <span>{analogySubtitle}</span>
        </div>
      )}
    </div>
  );
};

/** 底部老师敲黑板总结条 */
const TeacherChalkboardNote: React.FC<{ note?: string; delay?: number }> = ({
  note,
  delay = 20,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!note) return null;
  const p = spring({ frame: f - delay, fps, config: { damping: 14, stiffness: 130 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 86,
        right: 86,
        bottom: 148,
        zIndex: 45,
        display: "flex",
        justifyContent: "center",
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)`,
      }}
    >
      <div
        style={{
          background: "linear-gradient(90deg, rgba(30, 27, 75, 0.94), rgba(49, 16, 66, 0.94))",
          border: "2px solid #fbbf24",
          borderRadius: 18,
          padding: "10px 28px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(251, 191, 36, 0.28)",
        }}
      >
        <span style={{ fontSize: 28 }}>🧑‍🏫</span>
        <span style={{ fontSize: 24, fontWeight: 900, color: "#fef08a", letterSpacing: 0.6 }}>
          敲黑板：{note}
        </span>
      </div>
    </div>
  );
};

/* ==========================================================================
   1. analogy_3d: 课桌乱书堆 ➔ 时间轴横移穿行 (timeline-travel) ➔ 卡片甩入错题本俯瞰 (deck-deal-flyin)
   严格按照用户指定的三段式 3D 空间交互运镜实现：
   - 阶段 A (0% ~ 38%)：3D 实木课桌上横七竖八堆满写着各种记忆的 3D 立体书本，《花生严重过敏》被压在最底下
   - 阶段 B (38% ~ 68%)：时间线穿行 (timeline-travel) —— 镜头沿水平刻度轴加速掠过文本卡片，每过一格重要卡片弹立短停，末刻度急停推近
   - 阶段 C (68% ~ 100%)：卡片飞入错题本 (deck-deal-flyin) —— 重要卡片硬加速甩进网格，相机追着发牌升起后仰、落在整块满板的跑道式俯瞰上定格
   ========================================================================== */
export const AnalogyTheater3DScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const p1End = Math.floor(durationInFrames * 0.53);
  const p2End = Math.floor(durationInFrames * 0.77);

  const phaseBadge =
    f < p1End
      ? "镜头 1/3 · 3D 课桌乱书堆（传统长窗口痛点）"
      : f < p2End
      ? "镜头 2/3 · 时间轴横移穿行（弹立筛选重要记忆）"
      : "镜头 3/3 · 硬加速飞入错题本（跑道式俯瞰定格）";

  // ==================== 阶段 A：3D 实木课桌与 8 本随意摆放的 3D 记忆书本 ====================
  const deskBooks = [
    {
      title: "🚨 周三记录：我对花生严重过敏！",
      sub: "⚠️ 救命红线！却被压在书堆最底下找不到！",
      color: "#ef4444",
      spine: "#991b1b",
      x: -40,
      y: 10,
      z: 10,
      rotZ: -8,
      isImportant: true,
    },
    {
      title: "📘 周一闲聊：早上好呀今天天气不错",
      sub: "日常寒暄废话 · 白白占地方",
      color: "#3b82f6",
      spine: "#1e40af",
      x: -170,
      y: -70,
      z: 36,
      rotZ: -24,
      isImportant: false,
    },
    {
      title: "📙 周二吐槽：给我讲个冷笑话哈哈哈",
      sub: "闲聊噪音 · 每次提问还要重读一遍",
      color: "#f59e0b",
      spine: "#92400e",
      x: 110,
      y: -60,
      z: 58,
      rotZ: 19,
      isImportant: false,
    },
    {
      title: "📗 周四抱怨：今天外面下大雨真烦人",
      sub: "过时天气闲聊 · 毫无营养",
      color: "#10b981",
      spine: "#065f46",
      x: -70,
      y: 65,
      z: 82,
      rotZ: 14,
      isImportant: false,
    },
    {
      title: "📓 周五追问：这段代码怎么又报错了",
      sub: "临时排错记录 · 早已解决",
      color: "#8b5cf6",
      spine: "#5b21b6",
      x: 60,
      y: 30,
      z: 108,
      rotZ: -16,
      isImportant: false,
    },
    {
      title: "📔 周六随口：中午吃啥好呢随便聊聊",
      sub: "无意义水群记录",
      color: "#ec4899",
      spine: "#9d174d",
      x: -10,
      y: -20,
      z: 134,
      rotZ: 28,
      isImportant: false,
    },
    {
      title: "📒 周日寒暄：谢谢你呀晚安拜拜～",
      sub: "客套礼貌用语 · 堆在最顶上挡视线",
      color: "#06b6d4",
      spine: "#155e75",
      x: 15,
      y: 12,
      z: 160,
      rotZ: -6,
      isImportant: false,
    },
  ];

  const deskCamRotX = interpolate(f, [0, p1End], [56, 46], clamp);
  const deskCamRotZ = interpolate(f, [0, p1End], [-24, 16], clamp);
  const deskZoom = interpolate(f, [0, p1End * 0.8, p1End], [0.92, 1.05, 1.12], clamp);

  // ==================== 阶段 B：时间轴横移穿行 (timeline-travel 配方) ====================
  const p2Len = Math.max(30, p2End - p1End);
  const p2Local = Math.max(0, f - p1End);
  const travelStart = 6;
  const travelEnd = Math.floor(p2Len * 0.76);
  const zoomEnd = Math.floor(p2Len * 0.88);

  const TICK_GAP = 620;
  const timelineTicks = [
    {
      label: "Day 01",
      time: "周一 09:00",
      far: "MON",
      x: 560,
      title: "👋 “早上好呀天气真好”",
      desc: "日常寒暄废话 · 镜头直接掠过不收录",
      important: false,
      tag: "🗑️ 噪音略过",
      color: "#64748b",
    },
    {
      label: "Day 03",
      time: "周三 12:30",
      far: "WED",
      x: 560 + TICK_GAP,
      title: "🥜 “我对花生严重过敏！”",
      desc: "救命级饮食红线 · 重要卡片弹立提取！",
      important: true,
      tag: "⭐ 弹立提取 #1",
      color: "#f43f5e",
    },
    {
      label: "Day 08",
      time: "下周一 15:00",
      far: "WK2",
      x: 560 + TICK_GAP * 2,
      title: "💻 “我平时只用 Python 写后端”",
      desc: "长期工作技术栈 · 重要卡片弹立提取！",
      important: true,
      tag: "⭐ 弹立提取 #2",
      color: "#38bdf8",
    },
    {
      label: "Day 15",
      time: "上个月 18:00",
      far: "TODAY",
      x: 560 + TICK_GAP * 3,
      title: "📍 “我刚从北京搬到上海浦东”",
      desc: "最新居住地变更 · 末刻度急停推近特写！",
      important: true,
      tag: "🔥 末刻度急停推近",
      color: "#34d399",
    },
  ];

  const totalTravelDist = timelineTicks[timelineTicks.length - 1].x - 560;
  const camXAt = (lf: number) => {
    const t = interpolate(lf, [travelStart, travelEnd], [0, 1], clamp);
    const eased = interpolate(t, [0, 0.15, 0.88, 1], [0, 0.06, 0.9, 1], {
      easing: Easing.inOut(Easing.quad),
    });
    return eased * totalTravelDist;
  };

  const currentCamX = camXAt(p2Local);
  const timelineZoom = interpolate(p2Local, [travelEnd, zoomEnd], [1, 1.26], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  // ==================== 阶段 C：卡片硬加速甩入错题本 + 跑道式俯瞰 (deck-deal-flyin 配方) ====================
  const p3Len = Math.max(40, durationInFrames - p2End);
  const p3Local = Math.max(0, f - p2End);

  const notebookCards = [
    { icon: "🥜", cat: "饮食红线", title: "对花生严重过敏", sub: "点餐严禁含花生米/花生油", color: "#f43f5e" },
    { icon: "📍", cat: "现居城市", title: "刚搬到上海浦东", sub: "2026最新地址 · 原北京已归档", color: "#34d399" },
    { icon: "💻", cat: "主力语言", title: "Python 后端开发", sub: "代码示例默认使用 FastAPI", color: "#38bdf8" },
    { icon: "🌶️", cat: "口味偏好", title: "最爱川味水煮肉片", sub: "聚餐优先推荐无花生川菜", color: "#f59e0b" },
    { icon: "⏰", cat: "作息习惯", title: "习惯深夜 23 点写代码", sub: "夜间回答保持简洁直接", color: "#a78bfa" },
    { icon: "🚫", cat: "回答禁忌", title: "讨厌长篇套话寒暄", sub: "直接给结论与可运行代码", color: "#ec4899" },
  ];

  // 牌堆起始位置（错题本右侧桌面）
  const PILE_X = 1180;
  const PILE_Y = 140;
  const dealStart = Math.floor(p3Len * 0.16);

  // Hermite 样条相机：从牌堆侧斜特写 -> 追着发牌升起后仰 -> 落在整块满板的跑道式俯瞰上定格
  const camFrames = [
    0,
    Math.floor(p3Len * 0.18),
    Math.floor(p3Len * 0.48),
    Math.floor(p3Len * 0.76),
    p3Len,
  ];
  const camZoomCurve = hermiteSpline(camFrames, [1.18, 1.12, 0.90, 0.75, 0.76]);
  const camRotXCurve = hermiteSpline(camFrames, [44, 38, 28, 48, 50]);
  const camRotYCurve = hermiteSpline(camFrames, [-22, 14, -2, -6, -6]);
  const camRotZCurve = hermiteSpline(camFrames, [8, -4, -10, -24, -24]);
  const camCxCurve = hermiteSpline(camFrames, [920, 860, 680, 620, 620]);
  const camCyCurve = hermiteSpline(camFrames, [260, 280, 360, 410, 410]);

  const p3Cam = {
    zoom: camZoomCurve(p3Local),
    rotX: camRotXCurve(p3Local),
    rotY: camRotYCurve(p3Local),
    rotZ: camRotZCurve(p3Local),
    cx: camCxCurve(p3Local),
    cy: camCyCurve(p3Local),
  };

  // 预备拍下压 (Anticipation)
  const antT = interpolate(p3Local, [Math.max(0, dealStart - 8), dealStart], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "第一课 · 3D 空间交互运镜"}
        analogySubtitle={
          data.subtitle || "课桌堆满书找断手 vs 时间轴挑出重点、硬加速甩进随身错题本！"
        }
        phaseBadge={phaseBadge}
      />

      {/* 主 3D 视口舞台 */}
      <div
        style={{
          flex: 1,
          position: "relative",
          borderRadius: 28,
          overflow: "hidden",
          background:
            "radial-gradient(circle at 50% 35%, rgba(56, 189, 248, 0.18), rgba(15, 23, 42, 0.85) 75%)",
          border: "2px solid rgba(255, 255, 255, 0.22)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          marginBottom: 40,
        }}
      >
        {/* ============================================================
            阶段 A (f < p1End)：真 3D 实木课桌 + 横七竖八堆叠的 3D 书本
           ============================================================ */}
        {f < p1End && (
          <AbsoluteFill
            style={{
              perspective: "1600px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* 左上角警示 HUD */}
            <div
              style={{
                position: "absolute",
                left: 36,
                top: 28,
                zIndex: 30,
                background: "rgba(127, 29, 29, 0.88)",
                border: "2px solid #f43f5e",
                borderRadius: 18,
                padding: "12px 22px",
                boxShadow: "0 10px 30px rgba(244, 63, 94, 0.35)",
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: "#ffe4e6" }}>
                ❌ 笨办法：把整学期的聊天记录全堆在课桌上
              </div>
              <div style={{ fontSize: 19, color: "#fda4af", marginTop: 4 }}>
                每次提问都要重翻 26,000 字，压在最底下的【花生过敏】直接被漏看！
              </div>
            </div>

            {/* 3D 课桌世界容器 */}
            <div
              style={{
                width: 920,
                height: 540,
                position: "relative",
                transformStyle: "preserve-3d",
                transform: `scale(${deskZoom}) rotateX(${deskCamRotX}deg) rotateZ(${deskCamRotZ}deg) translateY(30px)`,
              }}
            >
              {/* 课桌地面阴影 */}
              <div
                style={{
                  position: "absolute",
                  inset: -30,
                  borderRadius: 40,
                  background: "rgba(0,0,0,0.55)",
                  filter: "blur(30px)",
                  transform: "translateZ(-130px)",
                }}
              />

              {/* 4 根 3D 实木桌腿 */}
              {[
                [40, 40],
                [820, 40],
                [40, 440],
                [820, 440],
              ].map(([lx, ly], li) => (
                <div
                  key={li}
                  style={{
                    position: "absolute",
                    left: lx,
                    top: ly,
                    width: 28,
                    height: 130,
                    background: "linear-gradient(90deg, #78350f, #b45309, #451a03)",
                    transformOrigin: "top center",
                    transform: "rotateX(-90deg)",
                    borderRadius: 6,
                  }}
                />
              ))}

              {/* 3D 实木课桌桌面 */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 24,
                  background:
                    "repeating-linear-gradient(90deg, rgba(120,53,15,0.18) 0px, rgba(120,53,15,0.18) 18px, transparent 18px, transparent 38px), linear-gradient(135deg, #f59e0b 0%, #d97706 48%, #b45309 100%)",
                  border: "4px solid #fde68a",
                  boxShadow: "inset 0 0 40px rgba(120, 53, 15, 0.55), 0 20px 40px rgba(0,0,0,0.6)",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* 课桌前侧立体木板厚度 (抽屉面板) */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -36,
                    height: 36,
                    background: "linear-gradient(180deg, #92400e, #78350f)",
                    borderTop: "2px solid #fbbf24",
                    transformOrigin: "top center",
                    transform: "rotateX(-90deg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fde68a",
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: 4,
                  }}
                >
                  ═══ AI 上下文课桌 (CONTEXT DESK · 已堆满超载 99%) ═══
                </div>

                {/* 桌面上的 7 本 3D 立体书本（带封皮、书脊、白色书页厚度） */}
                {deskBooks.map((b, bi) => {
                  const dropP = spring({
                    frame: f - bi * 4,
                    fps,
                    config: { damping: 12, stiffness: 130 },
                  });
                  const currentZ = interpolate(dropP, [0, 1], [b.z + 180, b.z]);
                  const pulseAlert = b.isImportant ? 1 + Math.sin(f * 0.25) * 0.05 : 1;

                  return (
                    <div
                      key={bi}
                      style={{
                        position: "absolute",
                        left: 460 + b.x - 210,
                        top: 270 + b.y - 75,
                        width: 420,
                        height: 150,
                        transformStyle: "preserve-3d",
                        transform: `translate3d(0px, 0px, ${currentZ}px) rotateZ(${b.rotZ}deg) scale(${pulseAlert})`,
                      }}
                    >
                      {/* 书本侧面白色书页厚度层 */}
                      <div
                        style={{
                          position: "absolute",
                          left: 6,
                          right: 6,
                          bottom: -22,
                          height: 22,
                          background:
                            "repeating-linear-gradient(180deg, #f8fafc 0px, #f8fafc 2px, #cbd5e1 2px, #cbd5e1 4px)",
                          transformOrigin: "top center",
                          transform: "rotateX(-90deg)",
                          borderRadius: "0 0 4px 4px",
                        }}
                      />
                      {/* 书本左侧装订书脊 */}
                      <div
                        style={{
                          position: "absolute",
                          left: -18,
                          top: 0,
                          bottom: 0,
                          width: 18,
                          background: b.spine,
                          transformOrigin: "right center",
                          transform: "rotateY(-90deg)",
                        }}
                      />
                      {/* 书本精装封皮 */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: `linear-gradient(135deg, ${b.color}, ${b.spine})`,
                          border: b.isImportant ? "3px solid #fef08a" : "2px solid rgba(255,255,255,0.45)",
                          borderRadius: "6px 16px 16px 6px",
                          padding: "16px 22px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxShadow: b.isImportant
                            ? "0 0 35px rgba(244, 63, 94, 0.9), 0 12px 24px rgba(0,0,0,0.6)"
                            : "0 14px 28px rgba(0,0,0,0.55)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: 15,
                              fontFamily: MONO,
                              fontWeight: 900,
                              background: "rgba(0,0,0,0.35)",
                              padding: "2px 10px",
                              borderRadius: 6,
                              color: "#ffffff",
                            }}
                          >
                            {b.isImportant ? "🚨 救命关键记忆 (被压在最底下!)" : `📚 聊天记录厚书 #0${bi}`}
                          </span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "#fef08a" }}>
                            3,800 字
                          </span>
                        </div>
                        <div style={{ fontSize: 23, fontWeight: 900, color: "#ffffff" }}>{b.title}</div>
                        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.88)", fontWeight: 700 }}>
                          {b.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AbsoluteFill>
        )}

        {/* ============================================================
            阶段 B (p1End <= f < p2End)：时间线穿行 (timeline-travel)
            镜头沿水平刻度轴加速掠过文本卡片，每过一格重要卡片弹立短停，末刻度急停推近
           ============================================================ */}
        {f >= p1End && f < p2End && (
          <AbsoluteFill style={{ overflow: "hidden" }}>
            {/* 远景视差大字 (0.35x 速度平移) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `scale(${1 + (timelineZoom - 1) * 0.35})`,
                transformOrigin: "50% 62%",
              }}
            >
              {timelineTicks.map((t, i) => {
                const d = Math.abs(currentCamX - i * TICK_GAP) / TICK_GAP;
                const op = Math.max(0, 1 - d / 0.75);
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: 560 + i * TICK_GAP * 0.35 - currentCamX * 0.35 - 350,
                      width: 700,
                      top: 90,
                      textAlign: "center",
                      fontSize: 210,
                      fontWeight: 900,
                      color: `rgba(255, 255, 255, ${(0.07 * op).toFixed(3)})`,
                      letterSpacing: "-0.04em",
                      pointerEvents: "none",
                    }}
                  >
                    {t.far}
                  </div>
                );
              })}
            </div>

            {/* 急停推近层 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: `scale(${timelineZoom})`,
                transformOrigin: "50% 60%",
              }}
            >
              {/* 横向飞驰世界层 */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 3400,
                  height: "100%",
                  transform: `translateX(${(320 - currentCamX).toFixed(2)}px)`,
                }}
              >
                {/* 水平主刻度轴线 */}
                <div
                  style={{
                    position: "absolute",
                    left: 160,
                    top: 430,
                    width: 2900,
                    height: 4,
                    background:
                      "linear-gradient(90deg, transparent 0%, #38bdf8 8%, #fbbf24 50%, #34d399 92%, transparent 100%)",
                    boxShadow: "0 0 20px rgba(56, 189, 248, 0.6)",
                  }}
                />

                {/* 次级速度参照刻度短杠 */}
                {Array.from({ length: 28 }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      left: 360 + idx * (TICK_GAP / 5),
                      top: 421,
                      width: 3,
                      height: idx % 5 === 0 ? 24 : 14,
                      background: idx % 5 === 0 ? "#ffffff" : "rgba(255,255,255,0.35)",
                      borderRadius: 2,
                    }}
                  />
                ))}

                {/* 主刻度节点与底边弹立卡片 */}
                {timelineTicks.map((tick, i) => {
                  // 计算相机扫过该刻度前 6 帧起弹
                  let popFrame = travelEnd;
                  for (let tf = travelStart; tf <= travelEnd; tf++) {
                    if (camXAt(tf) >= tick.x - 560) {
                      popFrame = tf;
                      break;
                    }
                  }
                  const trig = popFrame - 6;
                  const sp = spring({
                    frame: p2Local - trig,
                    fps,
                    config: { damping: 11, stiffness: 160, mass: 0.9 },
                  });
                  const lit = interpolate(p2Local, [trig, trig + 6], [0, 1], clamp);

                  return (
                    <div key={i} style={{ position: "absolute", left: tick.x, top: 0 }}>
                      {/* 刻度发光圆环 */}
                      <div
                        style={{
                          position: "absolute",
                          left: -18,
                          top: 430 - 18,
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: `${tick.color}44`,
                          transform: `scale(${0.6 + 0.5 * lit})`,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: -10,
                          top: 430 - 10,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: `4px solid ${tick.color}`,
                          background: lit > 0.5 ? tick.color : "#0f172a",
                          boxShadow: `0 0 16px ${tick.color}`,
                        }}
                      />

                      {/* 刻度下方时间标签 */}
                      <div
                        style={{
                          position: "absolute",
                          left: -120,
                          top: 458,
                          width: 240,
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 30, fontWeight: 900, color: "#ffffff" }}>
                          {tick.label}
                        </div>
                        <div style={{ fontSize: 19, color: "#cbd5e1", fontWeight: 700 }}>
                          {tick.time}
                        </div>
                      </div>

                      {/* 卡片从刻度线以底边为轴弹立 (scaleY 过冲) */}
                      {p2Local >= trig && (
                        <div
                          style={{
                            position: "absolute",
                            left: -210,
                            top: tick.important ? 115 : 225,
                            width: 420,
                            height: tick.important ? 275 : 170,
                            transformOrigin: "50% 100%",
                            transform: `scaleY(${sp}) scaleX(${0.86 + 0.14 * sp})`,
                            opacity: Math.min(1, sp * 2),
                            background: tick.important
                              ? "linear-gradient(160deg, rgba(15, 23, 42, 0.96), rgba(30, 27, 75, 0.92))"
                              : "rgba(15, 23, 42, 0.65)",
                            border: `3px solid ${tick.color}`,
                            borderRadius: 22,
                            padding: "20px 24px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: tick.important
                              ? `0 20px 45px rgba(0,0,0,0.6), 0 0 32px ${tick.color}66`
                              : "none",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                              style={{
                                background: `${tick.color}33`,
                                border: `1.5px solid ${tick.color}`,
                                color: "#ffffff",
                                padding: "4px 12px",
                                borderRadius: 999,
                                fontSize: 17,
                                fontWeight: 900,
                              }}
                            >
                              {tick.tag}
                            </span>
                            <span style={{ fontFamily: MONO, fontSize: 17, color: "#cbd5e1" }}>
                              {tick.time}
                            </span>
                          </div>
                          <div style={{ fontSize: 27, fontWeight: 900, color: "#ffffff" }}>
                            {tick.title}
                          </div>
                          <div style={{ fontSize: 19, color: "#e2e8f0", lineHeight: 1.4 }}>
                            {tick.desc}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </AbsoluteFill>
        )}

        {/* ============================================================
            阶段 C (f >= p2End)：卡片飞入错题本 (deck-deal-flyin)
            重要卡片硬加速甩进网格，相机追着发牌升起后仰、落在整块满板的跑道式俯瞰上定格
           ============================================================ */}
        {f >= p2End && (
          <AbsoluteFill style={{ overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                perspective: `${(2200 * p3Cam.zoom).toFixed(0)}px`,
                perspectiveOrigin: "50% 50%",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: 1600,
                  height: 920,
                  left: "50%",
                  top: "50%",
                  marginLeft: -800,
                  marginTop: -460,
                  transformStyle: "preserve-3d",
                  transform: `scale(${p3Cam.zoom.toFixed(3)}) rotateX(${p3Cam.rotX.toFixed(
                    2
                  )}deg) rotateY(${p3Cam.rotY.toFixed(2)}deg) rotateZ(${p3Cam.rotZ.toFixed(2)}deg)`,
                }}
              >
                {/* 3D 聪明错题本底板（暖白纸张 + 顶部金属活页环 + 侧边彩色索引签） */}
                <div
                  style={{
                    position: "absolute",
                    left: 110,
                    top: 60,
                    width: 1020,
                    height: 760,
                    borderRadius: 28,
                    background: "linear-gradient(180deg, #fffdf7 0%, #fef3c7 100%)",
                    border: "5px solid #f59e0b",
                    boxShadow:
                      "0 45px 100px rgba(0,0,0,0.7), 0 12px 0 #b45309, inset 0 0 30px rgba(245, 158, 11, 0.18)",
                    padding: "32px 38px",
                  }}
                >
                  {/* 错题本顶部活页线圈装饰 */}
                  <div
                    style={{
                      position: "absolute",
                      top: -18,
                      left: 80,
                      right: 80,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, ri) => (
                      <div
                        key={ri}
                        style={{
                          width: 18,
                          height: 34,
                          borderRadius: 9,
                          background: "linear-gradient(180deg, #e2e8f0, #64748b)",
                          border: "2px solid #1e293b",
                          boxShadow: "0 4px 8px rgba(0,0,0,0.4)",
                        }}
                      />
                    ))}
                  </div>

                  {/* 错题本页眉 */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "3px solid rgba(217, 119, 6, 0.3)",
                      paddingBottom: 14,
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#78350f" }}>
                      📒 Mem0 随身聪明错题本（SMART MEMORY NOTEBOOK）
                    </div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 20,
                        fontWeight: 900,
                        color: "#059669",
                        background: "#d1fae5",
                        padding: "4px 14px",
                        borderRadius: 999,
                      }}
                    >
                      ⚡ 0.15s 精准抽卡 · 省下 90% Token
                    </div>
                  </div>
                </div>

                {/* 6 张重要记忆卡：从右侧牌堆硬加速甩进错题本 3x2 网格 */}
                {notebookCards.map((c, k) => {
                  const col = k % 3;
                  const row = Math.floor(k / 3);
                  const targetX = 148 + col * 322;
                  const targetY = 175 + row * 285;

                  // 硬加速发牌节拍：间隔逐张收缩
                  const cue = dealStart + 5 * k - 0.35 * k * (k - 1);
                  const diveT = interpolate(p3Local, [cue, cue + 10], [0, 1], {
                    ...clamp,
                    easing: Easing.bezier(0.3, 0, 0.2, 1),
                  });
                  const settleT = interpolate(p3Local, [cue + 10, cue + 15], [0, 1], {
                    ...clamp,
                    easing: Easing.bezier(0.3, 0, 0.25, 1.15),
                  });

                  const inPile = p3Local < cue;
                  const isLanded = p3Local >= cue + 15;
                  const pz = (notebookCards.length - k) * 8;
                  const protZ = ((k * 11) % 9) - 4;

                  const dx = (PILE_X - targetX) * (1 - diveT);
                  const dy = (PILE_Y - targetY) * (1 - diveT);
                  const arcZ = Math.sin(diveT * Math.PI) * 140;
                  const z = inPile ? pz : (pz * (1 - diveT) + arcZ) * (1 - settleT);
                  const scale = inPile ? 1 : 1 + Math.sin(diveT * Math.PI) * 0.08;

                  // 预备拍下压与顶卡回拉
                  const antDy = inPile && p3Local < dealStart + 2 ? 36 * antT : 0;
                  const antPull = k === 0 && inPile ? 28 * antT : 0;

                  const transform = isLanded
                    ? "translate3d(0px, 0px, 4px)"
                    : inPile
                    ? `translate3d(${PILE_X - targetX - antPull}px, ${
                        PILE_Y - targetY + antDy
                      }px, ${pz}px) rotateZ(${protZ}deg)`
                    : `translate3d(${dx}px, ${dy}px, ${z}px) rotateZ(${
                        protZ * (1 - diveT)
                      }deg) scale(${scale})`;

                  return (
                    <div
                      key={k}
                      style={{
                        position: "absolute",
                        left: targetX,
                        top: targetY,
                        width: 298,
                        height: 245,
                        transform,
                        background: "linear-gradient(155deg, #1e1b4b, #0f172a)",
                        border: `3px solid ${c.color}`,
                        borderRadius: 22,
                        padding: "18px 20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        boxShadow: isLanded
                          ? `0 12px 24px rgba(0,0,0,0.35), 0 0 20px ${c.color}44`
                          : "0 32px 64px rgba(0,0,0,0.65)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            background: `${c.color}33`,
                            border: `1.5px solid ${c.color}`,
                            color: "#ffffff",
                            fontSize: 16,
                            fontWeight: 900,
                            padding: "3px 12px",
                            borderRadius: 999,
                          }}
                        >
                          {c.cat}
                        </span>
                        <span style={{ fontSize: 32 }}>{c.icon}</span>
                      </div>
                      <div style={{ fontSize: 25, fontWeight: 900, color: "#ffffff" }}>{c.title}</div>
                      <div style={{ fontSize: 17, color: "#cbd5e1", lineHeight: 1.4 }}>{c.sub}</div>
                      <div
                        style={{
                          fontFamily: MONO,
                          fontSize: 14,
                          color: c.color,
                          fontWeight: 900,
                          borderTop: "1px solid rgba(255,255,255,0.15)",
                          paddingTop: 6,
                        }}
                      >
                        CARD #0{k + 1} · INDEXED ✓
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 左下角跑道俯瞰实时落位计数器 */}
            <div
              style={{
                position: "absolute",
                left: 36,
                bottom: 24,
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid #34d399",
                borderRadius: 16,
                padding: "10px 22px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <span style={{ fontSize: 28 }}>📒</span>
              <div style={{ fontSize: 21, fontWeight: 900, color: "#ffffff" }}>
                错题本跑道俯瞰：已高速归档{" "}
                <span style={{ color: "#34d399", fontFamily: MONO, fontSize: 26 }}>
                  06 / 06
                </span>{" "}
                张核心记忆卡！
              </div>
            </div>
          </AbsoluteFill>
        )}
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   2. funnel_3d: 3D 旋转刀片榨汁机 + 贝塞尔曲线粒子流 + 废话坠落垃圾桶 + 3D 圆柱记忆胶囊
   ========================================================================== */
export const FunnelDistill3DScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rawInputs = data.raw_inputs || [
    { text: "👋 嗨！今天天气真不错呀～", keep: false, reason: "客套寒暄 · 直接丢弃" },
    { text: "🥜 我对花生严重过敏，千万别点花生！", keep: true, reason: "救命级事实 · 必须提炼" },
    { text: "😂 哈哈哈刚才那个笑话太逗了", keep: false, reason: "闲聊噪音 · 直接丢弃" },
    { text: "💻 我平时只用 Python 写后端服务", keep: true, reason: "长期工作习惯 · 存入档案" },
    { text: "🏠 我上个月刚从北京搬到上海浦东", keep: true, reason: "最新状态变更 · 存入档案" },
  ];

  const distilledOutputs = data.distilled_outputs || [
    { icon: "🥜", tag: "健康禁忌", fact: "对花生严重过敏（点餐严禁含花生）", color: "#fb7185" },
    { icon: "💻", tag: "职业技能", fact: "主力语言 Python（偏好后端代码示例）", color: "#38bdf8" },
    { icon: "📍", tag: "居住地点", fact: "现居上海浦东（原居北京已归档）", color: "#34d399" },
  ];

  const bladeAngle = f * 4.5;
  const stageTiltY = Math.sin(f * 0.03) * 5;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "功能拆解 ① · 3D 榨汁机萃取动画"}
        analogySubtitle={
          data.subtitle ||
          "就像做鲜榨果汁：把果皮果核（日常废话）滤进下方垃圾桶，只留最甜的纯果汁（3D 记忆胶囊）！"
        }
      />

      <div
        style={{
          flex: 1,
          position: "relative",
          perspective: "1700px",
          display: "grid",
          gridTemplateColumns: "1.15fr 0.95fr 1.2fr",
          alignItems: "center",
          gap: 24,
          marginBottom: 40,
        }}
      >
        {/* 贝塞尔曲线管道与高速彗星粒子 */}
        <svg
          width="1760"
          height="660"
          viewBox="0 0 1760 660"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
        >
          <defs>
            <linearGradient id="juicePipe" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#f472b6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {rawInputs.map((item: any, i: number) => {
            const sy = 90 + i * 106;
            const d = `M 545 ${sy} C 690 ${sy}, 725 285, 865 285`;
            const t = (f * 0.024 + i * 0.19) % 1;
            const px = 545 + (865 - 545) * t;
            const py = sy + (285 - sy) * Math.pow(t, 1.5);
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={item.keep ? "url(#juicePipe)" : "rgba(255,255,255,0.22)"}
                  strokeWidth={item.keep ? 4.5 : 2.5}
                  strokeDasharray={item.keep ? "none" : "8 6"}
                />
                <circle
                  cx={px}
                  cy={py}
                  r={item.keep ? 8 : 5}
                  fill={item.keep ? "#fbbf24" : "#94a3b8"}
                />
              </g>
            );
          })}

          {/* 废渣垂直排料管 */}
          <path
            d="M 865 365 L 865 520"
            fill="none"
            stroke="#fb7185"
            strokeWidth="5"
            strokeDasharray="10 8"
          />

          {/* 右侧纯果汁胶囊输送管 */}
          {distilledOutputs.map((out: any, idx: number) => {
            const ey = 140 + idx * 165;
            const d = `M 865 285 C 970 285, 975 ${ey}, 1070 ${ey}`;
            return (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={out.color || "#34d399"}
                strokeWidth="5"
              />
            );
          })}
        </svg>

        {/* 左栏：3D 倾斜输入原话积木 */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            transform: `rotateY(${8 + stageTiltY * 0.4}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fef08a", marginBottom: 2 }}>
            🍎 第一步：日常聊天的带皮原话（含大量废话）
          </div>
          {rawInputs.map((item: any, i: number) => {
            const sp = spring({ frame: f - 4 - i * 5, fps, config: { damping: 14 } });
            return (
              <div
                key={i}
                style={{
                  opacity: sp,
                  transform: `translateX(${interpolate(sp, [0, 1], [-40, 0])}px)`,
                  background: item.keep
                    ? "linear-gradient(135deg, rgba(30, 58, 138, 0.9), rgba(49, 16, 66, 0.88))"
                    : "rgba(15, 23, 42, 0.72)",
                  border: `2px solid ${item.keep ? "#38bdf8" : "rgba(255,255,255,0.22)"}`,
                  borderRadius: 18,
                  padding: "12px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: item.keep ? "0 10px 25px rgba(56, 189, 248, 0.28)" : "none",
                }}
              >
                <div style={{ fontSize: 21, fontWeight: 800, color: item.keep ? "#ffffff" : "#cbd5e1" }}>
                  {item.text}
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    padding: "4px 12px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    background: item.keep ? "#0284c7" : "rgba(244, 63, 94, 0.28)",
                    color: "#ffffff",
                  }}
                >
                  {item.reason}
                </span>
              </div>
            );
          })}
        </div>

        {/* 中栏：真 3D 旋转刀片榨汁漏斗 + 下方 3D 废话垃圾桶 */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 0",
          }}
        >
          {/* 3D 圆柱漏斗腔体 */}
          <div
            style={{
              width: 250,
              height: 270,
              perspective: "1000px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* 顶部进料漏斗口 3D 环 */}
            <div
              style={{
                width: 210,
                height: 54,
                borderRadius: "50%",
                background: "radial-gradient(circle, #0284c7, #1e1b4b)",
                border: "4px solid #38bdf8",
                transform: "rotateX(65deg) translateY(-20px)",
                boxShadow: "0 0 30px rgba(56, 189, 248, 0.6)",
              }}
            />
            {/* 透明玻璃榨汁机身 + 内部高速旋转涡轮刀片 */}
            <div
              style={{
                width: 186,
                height: 170,
                borderRadius: "24px 24px 55px 55px",
                background:
                  "linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(244, 114, 182, 0.32))",
                border: "3px solid #ffffff",
                boxShadow:
                  "0 20px 50px rgba(0,0,0,0.55), 0 0 40px rgba(244, 114, 182, 0.45), inset 0 0 30px rgba(255,255,255,0.35)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* 旋转涡轮光环 */}
              <div
                style={{
                  position: "absolute",
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  border: "5px dashed #fef08a",
                  transform: `rotate(${bladeAngle}deg)`,
                  opacity: 0.65,
                }}
              />
              <div style={{ fontSize: 42, position: "relative", zIndex: 5 }}>🍹</div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  color: "#ffffff",
                  position: "relative",
                  zIndex: 5,
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                }}
              >
                {data.funnel_name || "Mem0 记忆榨汁机"}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#fef08a",
                  position: "relative",
                  zIndex: 5,
                }}
              >
                LLM 单次萃取 · 滤除废话
              </div>
            </div>
          </div>

          {/* 底部 3D 废渣粉碎垃圾桶（带开合桶盖动画） */}
          <div
            style={{
              width: 270,
              background: "linear-gradient(180deg, rgba(136, 19, 55, 0.88), rgba(76, 5, 25, 0.95))",
              border: "2.5px solid #fb7185",
              borderRadius: "12px 12px 26px 26px",
              padding: "14px 20px",
              textAlign: "center",
              boxShadow: "0 16px 35px rgba(0,0,0,0.55), 0 0 25px rgba(251, 113, 133, 0.3)",
              transform: `translateY(${Math.sin(f * 0.2) * 3}px)`,
            }}
          >
            <div style={{ fontSize: 21, fontWeight: 900, color: "#ffe4e6" }}>
              🗑️ 3D 果渣回收桶（0 内存占用）
            </div>
            <div style={{ fontSize: 16, color: "#fda4af", fontWeight: 700, marginTop: 4 }}>
              已粉碎丢弃：“早上好 / 哈哈哈笑话”
            </div>
          </div>
        </div>

        {/* 右栏：3 颗 3D 立体发光圆柱记忆胶囊 */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            transform: `rotateY(${-8 + stageTiltY * 0.4}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 900, color: "#6ee7b7", marginBottom: 2 }}>
            💊 第三步：榨出的纯净 3D 记忆胶囊（直接入库）
          </div>
          {distilledOutputs.map((out: any, idx: number) => {
            const sp = spring({ frame: f - 20 - idx * 8, fps, config: { damping: 12 } });
            const color = out.color || "#34d399";
            return (
              <div
                key={idx}
                style={{
                  opacity: sp,
                  transform: `translateX(${interpolate(sp, [0, 1], [50, 0])}px) scale(${sp})`,
                  background: `linear-gradient(135deg, rgba(15, 23, 42, 0.95), ${color}33)`,
                  border: `3px solid ${color}`,
                  borderRadius: 999,
                  padding: "16px 28px",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  boxShadow: `0 18px 38px rgba(0,0,0,0.55), 0 0 28px ${color}55, inset 0 3px 12px rgba(255,255,255,0.35)`,
                }}
              >
                <div
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, #ffffff, ${color})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 34,
                    flexShrink: 0,
                    boxShadow: `0 0 20px ${color}`,
                  }}
                >
                  {out.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span
                      style={{
                        background: color,
                        color: "#0f172a",
                        fontSize: 16,
                        fontWeight: 900,
                        padding: "2px 12px",
                        borderRadius: 999,
                      }}
                    >
                      {out.tag}
                    </span>
                    <span style={{ fontSize: 15, fontFamily: MONO, color: "#e2e8f0", fontWeight: 800 }}>
                      CAPSULE #0{idx + 1}
                    </span>
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 900, color: "#ffffff" }}>{out.fact}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   3. timeline_3d: 3D 橡皮擦擦破纸张 vs 3D 立体翻页编年史日记与时空彩虹拱桥
   ========================================================================== */
export const TimelineEvolution3DScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const events = data.events || [
    {
      time: "2024年 · 3月",
      title: "“我在北京海淀工作”",
      status: "archived",
      badge: "📜 第1页：历史印记（完整保留）",
      desc: "记下当时住在北京，绝不用橡皮擦粗暴涂掉！",
      color: "#94a3b8",
    },
    {
      time: "2025年 · 8月",
      title: "“周末最爱吃川味水煮肉片”",
      status: "active",
      badge: "✅ 第2页：长期喜好（持续有效）",
      desc: "翻开新的一页补充饮食口味，和之前的日记互不冲突。",
      color: "#38bdf8",
    },
    {
      time: "2026年 · 上个月",
      title: "“我刚搬家到上海浦东了”",
      status: "latest",
      badge: "🌟 第3页：最新状态（优先采用）",
      desc: "盖上【最新时间印章】，AI 既知道现在住上海，也记得过去待过北京！",
      color: "#34d399",
    },
  ];

  const eraserRubX = Math.sin(f * 0.28) * 18;
  const bookTiltX = interpolate(f, [0, 60], [28, 16], clamp);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "功能拆解 ② · 3D 立体编年史日记"}
        analogySubtitle={
          data.subtitle ||
          "普通软件像拿橡皮擦改作业，擦掉旧的就忘了过去；Mem0 像立体编年史日记，每页盖上日期印章！"
        }
      />

      {/* 顶部：3D 橡皮擦破坏性涂改 vs 编年史追加 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.25fr",
          gap: 24,
          marginBottom: 18,
          zIndex: 25,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(136, 19, 55, 0.85), rgba(30, 27, 75, 0.9))",
            border: "2px solid #fb7185",
            borderRadius: 20,
            padding: "12px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 10px 28px rgba(0,0,0,0.4)",
          }}
        >
          {/* 摇晃摩擦的 3D 橡皮擦 */}
          <div
            style={{
              width: 68,
              height: 46,
              borderRadius: 10,
              background: "linear-gradient(90deg, #3b82f6 40%, #f43f5e 40%)",
              border: "2px solid #ffffff",
              transform: `translateX(${eraserRubX}px) rotate(-14deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 900,
              color: "#ffffff",
              boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
              flexShrink: 0,
            }}
          >
            ERASER
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffe4e6" }}>
              ❌ 普通软件（拿橡皮擦 UPDATE/DELETE 涂改旧记忆）
            </div>
            <div style={{ fontSize: 17, color: "#fecdd3" }}>
              把<del style={{ color: "#f43f5e" }}>“2024住北京”</del>直接擦破涂成“上海” ➡️ 问“我以前在哪住？”当场失忆！
            </div>
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, rgba(6, 78, 59, 0.88), rgba(30, 27, 75, 0.9))",
            border: "2px solid #34d399",
            borderRadius: 20,
            padding: "12px 22px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 10px 28px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ fontSize: 40 }}>📖</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#6ee7b7" }}>
              ✅ Mem0 独创（ADD-Only 只增不删 + 时间印章推理）
            </div>
            <div style={{ fontSize: 17, color: "#d1fae5" }}>
              绝不用橡皮擦！只往立体书后面翻新页、盖时间戳 ➡️ 历史与现状双全！
            </div>
          </div>
        </div>
      </div>

      {/* 主舞台：3D 立体翻页编年史大书底座 + 3 页弹起立体书页 + 彩虹拱桥 */}
      <div
        style={{
          flex: 1,
          position: "relative",
          perspective: "1700px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 40,
        }}
      >
        {/* 3D 摊开的精装大书底座 */}
        <div
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            bottom: 6,
            height: 170,
            background: "linear-gradient(180deg, #fef3c7 0%, #fde68a 75%, #d97706 100%)",
            borderRadius: 28,
            border: "4px solid #f59e0b",
            transform: `rotateX(${bookTiltX}deg)`,
            transformOrigin: "center bottom",
            boxShadow: "0 28px 60px rgba(0,0,0,0.65), 0 10px 0 #92400e",
          }}
        />

        {/* 跨越第1页到第3页的 3D 发光时空拱桥 SVG */}
        <svg
          width="1740"
          height="420"
          viewBox="0 0 1740 420"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 25 }}
        >
          <defs>
            <linearGradient id="chronicleBridge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path
            d="M 290 95 Q 870 -35 1450 95"
            fill="none"
            stroke="url(#chronicleBridge)"
            strokeWidth="5"
            strokeDasharray="12 6"
          />
        </svg>

        <div
          style={{
            position: "absolute",
            top: 4,
            zIndex: 30,
            background: "rgba(30, 27, 75, 0.95)",
            border: "2px solid #fbbf24",
            borderRadius: 999,
            padding: "6px 24px",
            fontSize: 20,
            fontWeight: 900,
            color: "#fef08a",
            boxShadow: "0 0 24px rgba(251, 191, 36, 0.45)",
          }}
        >
          {data.bridge_label || "🔗 时空演进拱桥：从【2024住北京】演进到【2026住上海】，过去与现在一清二楚！"}
        </div>

        {/* 3 座从大书底座上立起的 3D 立体书页 */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 32,
            padding: "42px 48px 18px",
          }}
        >
          {events.map((ev: any, i: number) => {
            const sp = spring({
              frame: f - 8 - i * 12,
              fps,
              config: { damping: 12, stiffness: 140 },
            });
            const popRotX = interpolate(sp, [0, 1], [-85, 0]);
            const isLatest = i === events.length - 1;
            const color = ev.color || "#38bdf8";

            return (
              <div
                key={i}
                style={{
                  transformOrigin: "center bottom",
                  transform: `rotateX(${popRotX}deg) scale(${isLatest ? 1.04 : 1})`,
                  opacity: Math.min(1, sp * 1.5),
                  background: isLatest
                    ? "linear-gradient(160deg, rgba(6, 78, 59, 0.96), rgba(15, 23, 42, 0.96))"
                    : "linear-gradient(160deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95))",
                  border: `3px solid ${color}`,
                  borderRadius: "24px 24px 10px 10px",
                  padding: "22px 26px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: `0 22px 45px rgba(0,0,0,0.6), 0 0 30px ${color}44`,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 19,
                        fontWeight: 900,
                        color: "#0f172a",
                        background: color,
                        padding: "4px 14px",
                        borderRadius: 999,
                      }}
                    >
                      📅 {ev.time}
                    </span>
                    <span
                      style={{
                        fontSize: 17,
                        fontWeight: 900,
                        color: "#fef08a",
                        border: "1.5px solid #fbbf24",
                        padding: "2px 10px",
                        borderRadius: 8,
                      }}
                    >
                      印章已盖 ✓
                    </span>
                  </div>

                  <div style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", marginBottom: 10 }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: 20, color: "#e2e8f0", lineHeight: 1.48, marginBottom: 16 }}>
                    {ev.desc}
                  </div>
                </div>

                <div
                  style={{
                    background: `${color}28`,
                    border: `1.5px solid ${color}`,
                    borderRadius: 12,
                    padding: "8px 14px",
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#ffffff",
                    textAlign: "center",
                  }}
                >
                  {ev.badge}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   4. exploded_3d: 3/4 等轴测三层记忆大厦 Z 轴爆炸拆解 (video-shotcraft ExplodedView)
   包含：预备下蹲 -> Z轴弹簧分层炸开 -> 3D环绕与全息引线 -> 末尾蓄力合体
   ========================================================================== */
export const ExplodedArchitecture3DScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const layers = data.layers || [
    {
      name: "顶楼 · Graph 人物关系网（Kuzu 图数据库）",
      metaphor: "🕸️ 侦探墙上的红线关系网",
      detail: "把【小明】—【现居】—【上海】和【过敏】—【花生】连成网，顺着一根藤就能摸出整串瓜！",
      color: "#c084fc",
      icon: "🕸️",
    },
    {
      name: "二楼 · Vector 意思联想库（Qdrant 向量库）",
      metaphor: "🧭 按意思找近义词的聪明词典",
      detail: "就算你没提“过敏”，只问“今晚点什么菜安全”，它也能靠意思联想到【花生禁忌】！",
      color: "#38bdf8",
      icon: "🧭",
    },
    {
      name: "一楼地基 · SQLite 流水记账本（审计主库）",
      metaphor: "📒 一笔不漏的银行流水金库",
      detail: "记录每一条记忆是什么时候加进来的、改过几次，断网也能在本地毫秒级读写！",
      color: "#34d399",
      icon: "📒",
    },
  ];

  // 1) 预备下蹲 (f4~12) -> 2) Z轴弹簧爆炸 (f12~) -> 3) 末尾合体
  const crouch = interpolate(f, [4, 12, 18], [0, -18, 0], clamp);
  const explodeP = spring({ frame: f - 12, fps, config: { damping: 13, stiffness: 115 } });
  const slamBack =
    durationInFrames > 120
      ? interpolate(f, [durationInFrames - 26, durationInFrames - 10], [0, 1], {
          ...clamp,
          easing: Easing.in(Easing.cubic),
        })
      : 0;
  const spread = explodeP * (1 - slamBack);

  const rotX = 54 + Math.sin(f * 0.035) * 3;
  const rotZ = -28 + Math.cos(f * 0.028) * 5;
  const zOffsets = [150, 0, -150];

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "功能拆解 ③ · 3/4 等轴测 3D 爆炸拆解"}
        analogySubtitle={
          data.subtitle ||
          "把记忆大厦沿 Z 轴炸开看：一楼金库记流水账，二楼罗盘按意思联想，三楼连成人物关系红线网！"
        }
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr",
          alignItems: "center",
          gap: 28,
          marginBottom: 40,
        }}
      >
        {/* 左侧：真 3D 3/4 等轴测爆炸大厦 */}
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            perspective: "1800px",
          }}
        >
          {/* 底部能量光池 */}
          <div
            style={{
              position: "absolute",
              width: 420,
              height: 420,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(56, 189, 248, 0.38), transparent 70%)",
              filter: "blur(22px)",
              transform: "translateY(110px) scaleY(0.45)",
            }}
          />

          <div
            style={{
              width: 400,
              height: 270,
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `translateY(${crouch}px) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`,
            }}
          >
            {/* 4 根贯穿三层大厦的发光激光电梯立柱 */}
            {[
              [-165, -100],
              [165, -100],
              [-165, 100],
              [165, 100],
            ].map(([px, py], pi) => (
              <div
                key={pi}
                style={{
                  position: "absolute",
                  left: 200 + px,
                  top: 135 + py,
                  width: 4,
                  height: 300 * spread,
                  background: "linear-gradient(180deg, #c084fc, #38bdf8, #34d399)",
                  transformOrigin: "top center",
                  transform: `translateZ(${150 * spread}px) rotateX(-90deg)`,
                  opacity: spread * 0.85,
                  boxShadow: "0 0 16px #38bdf8",
                }}
              />
            ))}

            {/* 三层 3D 立体楼板（带侧面楼板厚度与内部立体微缩道具） */}
            {layers.map((layer: any, idx: number) => {
              const z = (zOffsets[idx] || 0) * spread;
              const color = layer.color || COLORS.accent;
              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformStyle: "preserve-3d",
                    transform: `translateZ(${z}px)`,
                  }}
                >
                  {/* 楼板前侧 3D 厚度边缘 */}
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      right: 10,
                      bottom: -18,
                      height: 18,
                      background: color,
                      opacity: 0.75,
                      transformOrigin: "top center",
                      transform: "rotateX(-90deg)",
                      borderRadius: "0 0 8px 8px",
                    }}
                  />

                  {/* 楼板主舱体 */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 26,
                      background: `linear-gradient(135deg, rgba(15, 23, 42, 0.95), ${color}44)`,
                      border: `3.5px solid ${color}`,
                      boxShadow: `0 22px 45px rgba(0,0,0,0.65), 0 0 32px ${color}55, inset 0 0 24px ${color}33`,
                      padding: "20px 26px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 18,
                          fontFamily: MONO,
                          fontWeight: 900,
                          color: "#0f172a",
                          background: color,
                          padding: "3px 12px",
                          borderRadius: 8,
                        }}
                      >
                        FLOOR 0{3 - idx}
                      </span>
                      <span style={{ fontSize: 38 }}>{layer.icon}</span>
                    </div>

                    <div>
                      <div style={{ fontSize: 25, fontWeight: 900, color: "#ffffff" }}>
                        {layer.metaphor}
                      </div>
                      <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 700, marginTop: 4 }}>
                        {layer.name}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：与三层楼一一对应的老师拆解卡 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, zIndex: 20 }}>
          {layers.map((layer: any, idx: number) => {
            const sp = spring({ frame: f - 16 - idx * 9, fps, config: { damping: 14 } });
            const color = layer.color || COLORS.accent;
            return (
              <div
                key={idx}
                style={{
                  opacity: sp,
                  transform: `translateX(${interpolate(sp, [0, 1], [45, 0])}px)`,
                  background: "rgba(15, 23, 42, 0.9)",
                  borderLeft: `8px solid ${color}`,
                  borderTop: `2px solid ${color}88`,
                  borderRight: `2px solid ${color}88`,
                  borderBottom: `2px solid ${color}88`,
                  borderRadius: "14px 24px 24px 14px",
                  padding: "16px 24px",
                  boxShadow: `0 14px 32px rgba(0,0,0,0.45), 0 0 20px ${color}22`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                  <span style={{ fontSize: 34 }}>{layer.icon}</span>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#ffffff" }}>
                      {layer.name}
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color }}>
                      生活比喻：{layer.metaphor}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 20, color: "#f1f5f9", lineHeight: 1.45 }}>
                  {layer.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   5. radar_sim: 四路侦探 3D 中枢翻转 + 彩虹脉冲光管 + 满弧扫针仪表盘 (integration-hub-map + needle-sweep)
   ========================================================================== */
export const FourSignalRadarSimScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const query = data.query || "❓ 用户提问：“今晚请小明吃饭，订哪家餐厅最稳妥？”";
  const signals = data.signals || [
    {
      name: "1号侦探 · 向量意思联想 (Vector)",
      analogy: "懂弦外之音的语文课代表",
      clue: "看到“订餐厅稳妥” ➡️ 联想到【饮食安全与忌口】",
      score: 92,
      color: "#38bdf8",
      icon: "🧭",
    },
    {
      name: "2号侦探 · 字面原词搜索 (BM25)",
      analogy: "拿放大镜找原词的纪律委员",
      clue: "精准锁定含【吃饭 / 餐厅 / 过敏】字眼的原始记录",
      score: 88,
      color: "#fbbf24",
      icon: "🔍",
    },
    {
      name: "3号侦探 · 关系网顺藤摸瓜 (Graph)",
      analogy: "擅长拔出萝卜带出泥的侦探迷",
      clue: "顺着【小明】➡️【刚搬到上海】+【花生过敏】连线锁定范围",
      score: 95,
      color: "#c084fc",
      icon: "🕸️",
    },
    {
      name: "4号侦探 · 时间新鲜度加权 (Temporal)",
      analogy: "专门看保质期的生活委员",
      clue: "把 2024 年【住北京】降权，把上个月【住上海浦东】置顶！",
      score: 98,
      color: "#34d399",
      icon: "⏱️",
    },
  ];

  // 仪表盘扫针动画 (0 -> 100 -> 96.5)
  const gaugeProgress = interpolate(f, [15, 55, 72], [0, 1.04, 0.965], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const totalScore = (gaugeProgress * 100).toFixed(1);

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "功能拆解 ④ · 四路侦探合议仿真"}
        analogySubtitle={
          data.subtitle ||
          "找记忆不能只靠一个办法！Mem0 派出 4 位本领不同的“小侦探”同时打分，合议出最准答案！"
        }
      />

      {/* 顶部提问与实时合议仪表盘 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 20,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            background: "linear-gradient(90deg, rgba(30, 58, 138, 0.9), rgba(49, 16, 66, 0.9))",
            border: "2.5px solid #38bdf8",
            borderRadius: 18,
            padding: "12px 24px",
            fontSize: 25,
            fontWeight: 900,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            boxShadow: "0 0 25px rgba(56, 189, 248, 0.35)",
          }}
        >
          {query}
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.92)",
            border: "2.5px solid #fbbf24",
            borderRadius: 18,
            padding: "10px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 0 25px rgba(251, 191, 36, 0.3)",
          }}
        >
          <span style={{ fontSize: 21, fontWeight: 900, color: "#fef08a" }}>
            🎯 综合合议得分表：
          </span>
          <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 900, color: "#34d399" }}>
            {totalScore} 分
          </span>
        </div>
      </div>

      {/* 4 座 3D 翻转侦探工作台 */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          perspective: "1600px",
          marginBottom: 16,
        }}
      >
        {signals.map((sig: any, i: number) => {
          const sp = spring({ frame: f - 6 - i * 7, fps, config: { damping: 12 } });
          const flipY = interpolate(sp, [0, 1], [90, 0]);
          const scoreP = interpolate(f, [20 + i * 6, 54 + i * 6], [0, 1], clamp);
          const currentScore = Math.round((sig.score || 90) * scoreP);
          const color = sig.color || "#38bdf8";

          return (
            <div
              key={i}
              style={{
                opacity: sp,
                transform: `rotateY(${flipY}deg) scale(${interpolate(sp, [0, 1], [0.9, 1])})`,
                background: "rgba(15, 23, 42, 0.92)",
                border: `2.5px solid ${color}`,
                borderRadius: 22,
                padding: "16px 22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: `0 14px 30px rgba(0,0,0,0.5), 0 0 24px ${color}33`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 34 }}>{sig.icon}</span>
                  <div>
                    <div style={{ fontSize: 23, fontWeight: 900, color: "#ffffff" }}>
                      {sig.name}
                    </div>
                    <div style={{ fontSize: 18, color, fontWeight: 800 }}>
                      角色比喻：{sig.analogy}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 900, color }}>
                  {currentScore}分
                </div>
              </div>

              <div style={{ fontSize: 20, color: "#f1f5f9", fontWeight: 700, margin: "6px 0" }}>
                🔎 查到线索：{sig.clue}
              </div>

              <div
                style={{
                  height: 14,
                  background: "rgba(51, 65, 85, 0.75)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${currentScore}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    borderRadius: 999,
                    boxShadow: `0 0 16px ${color}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部最终胜出答案 */}
      <div
        style={{
          marginBottom: 40,
          background: "linear-gradient(90deg, rgba(6, 78, 59, 0.92), rgba(15, 23, 42, 0.95))",
          border: "2.5px solid #34d399",
          borderRadius: 18,
          padding: "12px 26px",
          fontSize: 25,
          fontWeight: 900,
          color: "#ecfdf5",
          textAlign: "center",
          boxShadow: "0 0 32px rgba(52, 211, 153, 0.4)",
        }}
      >
        {data.final_result ||
          "🏆 最终合议结果（综合得分 96.5%）：订【上海浦东】的【无花生版川味水煮肉片】！"}
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   6. slider_scrub: 3D 餐桌实景与账单厚度卷帘对比 (before-after-slider-scrub)
   ========================================================================== */
export const SliderScrubCompareScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scrubPos = interpolate(
    f,
    [0, 16, Math.floor(durationInFrames * 0.45), Math.floor(durationInFrames * 0.76)],
    [85, 85, 16, 48],
    {
      ...clamp,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }
  );

  const before = data.before || {
    title: "❌ 没装 Mem0 的普通 AI（金鱼脑 + 烧钱机）",
    dialog_user: "“我周末想改善伙食，你给我推荐个拿手菜吧！”",
    dialog_ai: "“推荐你点【经典宫保鸡丁】，里面放满满的油炸花生米，超级香！”",
    disaster: "💥 惨案：AI 忘了你第 1 天说过【对花生严重过敏】，差点闹出大事！",
    tokens: "单次消耗 26,000 Tokens（厚厚一沓算力账单）",
    latency: "响应耗时：4.8 秒（慢如蜗牛）",
  };

  const after = data.after || {
    title: "✅ 装上 Mem0 的聪明 AI（贴心秘书 + 省钱王）",
    dialog_user: "“我周末想改善伙食，你给我推荐个拿手菜吧！”",
    dialog_ai: "“记得你【对花生严重过敏】且住上海爱吃辣，推荐点【无花生版水煮肉片】！”",
    success: "🎯 满分：自动从错题本抽出【花生过敏】红线卡片，安全又贴心！",
    tokens: "单次仅需 920 Tokens（直接省下 95% 算力账单！）",
    latency: "响应耗时：0.15 秒（闪电秒回）",
  };

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "实战效果实测 · 3D 餐桌与账单卷帘对比"}
        analogySubtitle={
          data.subtitle || "拉开中间的激光卷帘看看：同样一句话，失忆 AI 和有记忆的 AI 差别有多大！"
        }
      />

      <div
        style={{
          flex: 1,
          position: "relative",
          borderRadius: 28,
          overflow: "hidden",
          border: "3px solid rgba(255, 255, 255, 0.3)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
          marginBottom: 40,
        }}
      >
        {/* 底层（右侧揭晓）：AFTER 装上 Mem0 的安全餐桌 */}
        <AbsoluteFill
          style={{
            background: "linear-gradient(135deg, #064e3b 0%, #0f172a 70%)",
            padding: "28px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                background: "rgba(52, 211, 153, 0.25)",
                border: "2px solid #34d399",
                color: "#6ee7b7",
                borderRadius: 999,
                padding: "6px 20px",
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              {after.title}
            </span>
            <span style={{ fontSize: 24, fontFamily: MONO, color: "#34d399", fontWeight: 900 }}>
              AFTER · 安全省钱 ⚡
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 24, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.9)",
                  borderRadius: 16,
                  padding: "14px 22px",
                  fontSize: 23,
                  color: "#e2e8f0",
                }}
              >
                🧑 <strong>你的提问：</strong> {after.dialog_user}
              </div>
              <div
                style={{
                  background: "rgba(6, 78, 59, 0.8)",
                  border: "2.5px solid #34d399",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontSize: 25,
                  fontWeight: 900,
                  color: "#ecfdf5",
                }}
              >
                🤖 <strong>Mem0 回答：</strong> {after.dialog_ai}
              </div>
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.28)",
                  borderRadius: 14,
                  padding: "12px 20px",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#6ee7b7",
                }}
              >
                {after.success}
              </div>
            </div>

            {/* 右侧 3D 安全餐盘道具 */}
            <div
              style={{
                background: "radial-gradient(circle, rgba(52, 211, 153, 0.35), rgba(15, 23, 42, 0.92))",
                border: "3px solid #34d399",
                borderRadius: 26,
                padding: "22px",
                textAlign: "center",
                boxShadow: "0 20px 45px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ fontSize: 72 }}>🍲</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", marginTop: 6 }}>
                无花生版川味水煮肉片
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  background: "#10b981",
                  color: "#052e16",
                  fontWeight: 900,
                  fontSize: 18,
                  padding: "4px 14px",
                  borderRadius: 999,
                }}
              >
                ✅ 100% 避开花生过敏源
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <div
              style={{
                flex: 1,
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid #34d399",
                borderRadius: 16,
                padding: "12px 22px",
                fontSize: 22,
                fontWeight: 900,
                color: "#34d399",
              }}
            >
              💰 {after.tokens}
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid #38bdf8",
                borderRadius: 16,
                padding: "12px 22px",
                fontSize: 22,
                fontWeight: 900,
                color: "#38bdf8",
              }}
            >
              ⚡ {after.latency}
            </div>
          </div>
        </AbsoluteFill>

        {/* 顶层裁剪层（左侧）：BEFORE 没装 Mem0 的危险餐桌 */}
        <AbsoluteFill
          style={{
            clipPath: `inset(0 ${100 - scrubPos}% 0 0)`,
            background: "linear-gradient(135deg, #7f1d1d 0%, #0f172a 70%)",
            padding: "28px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span
              style={{
                background: "rgba(244, 63, 94, 0.28)",
                border: "2px solid #fb7185",
                color: "#ffe4e6",
                borderRadius: 999,
                padding: "6px 20px",
                fontSize: 24,
                fontWeight: 900,
              }}
            >
              {before.title}
            </span>
            <span style={{ fontSize: 24, fontFamily: MONO, color: "#fb7185", fontWeight: 900 }}>
              BEFORE · 传统失忆 ❌
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.65fr", gap: 24, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "rgba(30, 41, 59, 0.9)",
                  borderRadius: 16,
                  padding: "14px 22px",
                  fontSize: 23,
                  color: "#e2e8f0",
                }}
              >
                🧑 <strong>你的提问：</strong> {before.dialog_user}
              </div>
              <div
                style={{
                  background: "rgba(127, 29, 29, 0.8)",
                  border: "2.5px solid #f43f5e",
                  borderRadius: 16,
                  padding: "16px 22px",
                  fontSize: 25,
                  fontWeight: 900,
                  color: "#ffe4e6",
                }}
              >
                🤖 <strong>普通 AI 回答：</strong> {before.dialog_ai}
              </div>
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.32)",
                  borderRadius: 14,
                  padding: "12px 20px",
                  fontSize: 22,
                  fontWeight: 900,
                  color: "#fecdd3",
                }}
              >
                {before.disaster}
              </div>
            </div>

            {/* 左侧 3D 致命花生餐盘道具 */}
            <div
              style={{
                background: "radial-gradient(circle, rgba(244, 63, 94, 0.4), rgba(15, 23, 42, 0.92))",
                border: "3px solid #f43f5e",
                borderRadius: 26,
                padding: "22px",
                textAlign: "center",
                boxShadow: "0 20px 45px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ fontSize: 72 }}>🥜</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", marginTop: 6 }}>
                洒满花生米的宫保鸡丁
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  background: "#f43f5e",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: 18,
                  padding: "4px 14px",
                  borderRadius: 999,
                }}
              >
                🚨 致命过敏警报！
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <div
              style={{
                flex: 1,
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid #f43f5e",
                borderRadius: 16,
                padding: "12px 22px",
                fontSize: 22,
                fontWeight: 900,
                color: "#fb7185",
              }}
            >
              💸 {before.tokens}
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(15, 23, 42, 0.9)",
                border: "2px solid #f43f5e",
                borderRadius: 16,
                padding: "12px 22px",
                fontSize: 22,
                fontWeight: 900,
                color: "#fda4af",
              }}
            >
              🐢 {before.latency}
            </div>
          </div>
        </AbsoluteFill>

        {/* 激光卷帘分割杆 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${scrubPos}%`,
            width: 6,
            background: "#ffffff",
            boxShadow: "0 0 28px #38bdf8, 0 0 54px #34d399",
            zIndex: 30,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #38bdf8, #34d399)",
              border: "3px solid #ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 900,
              color: "#0f172a",
              boxShadow: "0 0 32px rgba(56, 189, 248, 0.9)",
            }}
          >
            ⟷
          </div>
        </div>
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   7. terminal_3d: 3D 空间三终端逆矩阵飞行运镜 (video-shotcraft Terminal3D)
   三个终端窗散布 3D 空间，相机窗间飞行、途中正弦拉远，每到一窗打字机敲命令 + 弹出 3D 便利贴
   ========================================================================== */
export const Terminal3DFlightScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const steps = data.steps || [
    {
      step: "第 1 步 · 买回错题本",
      windowTitle: "terminal — bash",
      code: "$ pip install mem0ai\n✓ Successfully installed mem0ai",
      teacherTip: "就像去文具店买回一本空白的聪明错题本，只要一行安装命令！",
      color: "#38bdf8",
    },
    {
      step: "第 2 步 · 往本子里记重点",
      windowTitle: "app.py — 存入记忆",
      code: 'from mem0 import Memory\nm = Memory()\nm.add("我对花生过敏，现居上海", user_id="xiaoming")',
      teacherTip: "调用 m.add()，Mem0 就会自动把这句话榨成纯净的记忆卡片存好！",
      color: "#c084fc",
    },
    {
      step: "第 3 步 · 随用随查秒回答",
      windowTitle: "app.py — 精准召回",
      code: 'hits = m.search("今晚吃什么安全？", user_id="xiaoming")\n# -> 命中：[花生严重过敏, 现居上海] (耗时 0.15s)',
      teacherTip: "哪怕问题里一个字没提“花生”，m.search() 也能瞬间把过敏卡片抽出来！",
      color: "#34d399",
    },
  ];

  // 三座终端在 3D 世界中的坐标与倾角
  const winPoses = [
    { x: -540, y: -10, z: 0, rotY: 22, rotX: 5 },
    { x: 0, y: 15, z: 90, rotY: 0, rotX: -4 },
    { x: 540, y: -10, z: 0, rotY: -22, rotX: 5 },
  ];

  const s1End = Math.floor(durationInFrames * 0.32);
  const f1End = Math.floor(durationInFrames * 0.40);
  const s2End = Math.floor(durationInFrames * 0.66);
  const f2End = Math.floor(durationInFrames * 0.74);

  let camX = winPoses[0].x;
  let camY = winPoses[0].y;
  let camZ = winPoses[0].z;
  let camRotY = winPoses[0].rotY;
  let camRotX = winPoses[0].rotX;
  let activeIdx = 0;

  if (f < s1End) {
    activeIdx = 0;
  } else if (f < f1End) {
    activeIdx = 1;
    const u = interpolate(f, [s1End, f1End], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    camX = interpolate(u, [0, 1], [winPoses[0].x, winPoses[1].x]);
    camY = interpolate(u, [0, 1], [winPoses[0].y, winPoses[1].y]);
    camZ = interpolate(u, [0, 1], [winPoses[0].z, winPoses[1].z]) - Math.sin(u * Math.PI) * 210;
    camRotY = interpolate(u, [0, 1], [winPoses[0].rotY, winPoses[1].rotY]);
    camRotX = interpolate(u, [0, 1], [winPoses[0].rotX, winPoses[1].rotX]);
  } else if (f < s2End) {
    activeIdx = 1;
    camX = winPoses[1].x;
    camY = winPoses[1].y;
    camZ = winPoses[1].z;
    camRotY = winPoses[1].rotY;
    camRotX = winPoses[1].rotX;
  } else if (f < f2End) {
    activeIdx = 2;
    const u = interpolate(f, [s2End, f2End], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    camX = interpolate(u, [0, 1], [winPoses[1].x, winPoses[2].x]);
    camY = interpolate(u, [0, 1], [winPoses[1].y, winPoses[2].y]);
    camZ = interpolate(u, [0, 1], [winPoses[1].z, winPoses[2].z]) - Math.sin(u * Math.PI) * 210;
    camRotY = interpolate(u, [0, 1], [winPoses[1].rotY, winPoses[2].rotY]);
    camRotX = interpolate(u, [0, 1], [winPoses[1].rotX, winPoses[2].rotX]);
  } else {
    activeIdx = 2;
    // 末段拉远俯瞰三窗全景
    const pullU = interpolate(f, [durationInFrames - 30, durationInFrames - 6], [0, 1], {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    });
    camX = interpolate(pullU, [0, 1], [winPoses[2].x, 0]);
    camY = interpolate(pullU, [0, 1], [winPoses[2].y, 0]);
    camZ = interpolate(pullU, [0, 1], [winPoses[2].z, -360]);
    camRotY = interpolate(pullU, [0, 1], [winPoses[2].rotY, 0]);
    camRotX = interpolate(pullU, [0, 1], [winPoses[2].rotX, 4]);
  }

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "动手实操 · 3D 空间三终端飞行"}
        analogySubtitle={
          data.subtitle || "别被高大上的原理吓到！真正写代码只需要像搭积木一样简单的 3 步！"
        }
        phaseBadge={`正在聚焦：${steps[activeIdx]?.step || ""}`}
      />

      <div
        style={{
          flex: 1,
          position: "relative",
          perspective: "1400px",
          overflow: "hidden",
          borderRadius: 28,
          border: "2px solid rgba(255,255,255,0.22)",
          background: "radial-gradient(circle at 50% 40%, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.85))",
          marginBottom: 40,
        }}
      >
        {/* 3D 相机逆变换世界层 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            transform: `translate3d(${-camX * 0.65}px, ${-camY}px, ${-camZ}px) rotateX(${
              -camRotX * 0.7
            }deg) rotateY(${-camRotY * 0.7}deg)`,
          }}
        >
          {steps.map((st: any, idx: number) => {
            const wp = winPoses[idx] || winPoses[0];
            const isFocused = idx === activeIdx;
            const color = st.color || "#38bdf8";
            const startF = idx === 0 ? 0 : idx === 1 ? s1End : s2End;
            const localF = Math.max(0, f - startF);
            const fullCode = String(st.code || "");
            const shownCode = fullCode.slice(0, Math.floor(localF * 2.5));

            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: -250,
                  top: -205,
                  width: 500,
                  height: 410,
                  transformStyle: "preserve-3d",
                  transform: `translate3d(${wp.x}px, ${wp.y}px, ${wp.z}px) rotateY(${wp.rotY}deg) rotateX(${wp.rotX}deg)`,
                  background: "rgba(10, 15, 28, 0.96)",
                  border: `3px solid ${isFocused ? color : "rgba(255,255,255,0.28)"}`,
                  borderRadius: 24,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: isFocused
                    ? `0 28px 65px rgba(0,0,0,0.75), 0 0 42px ${color}66`
                    : "0 16px 35px rgba(0,0,0,0.5)",
                }}
              >
                {/* 终端顶栏 */}
                <div
                  style={{
                    background: "rgba(30, 41, 59, 0.95)",
                    padding: "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#f43f5e" }} />
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }} />
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981" }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 16, color: "#cbd5e1", fontWeight: 800 }}>
                    {st.windowTitle}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: "#0f172a",
                      background: color,
                      padding: "2px 12px",
                      borderRadius: 999,
                    }}
                  >
                    {st.step}
                  </span>
                </div>

                {/* 代码打字机区 */}
                <pre
                  style={{
                    flex: 1,
                    margin: 0,
                    padding: "22px 24px",
                    fontFamily: MONO,
                    fontSize: 20,
                    lineHeight: 1.55,
                    color: "#f8fafc",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {shownCode}
                  {shownCode.length < fullCode.length && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 22,
                        background: color,
                        marginLeft: 4,
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </pre>

                {/* 底部黄色 3D 老师大白话便利贴 */}
                <div
                  style={{
                    background: "linear-gradient(90deg, #fef08a, #fde047)",
                    borderTop: "3px solid #f59e0b",
                    padding: "14px 20px",
                    fontSize: 19,
                    fontWeight: 900,
                    color: "#451a03",
                    lineHeight: 1.4,
                  }}
                >
                  📌 老师便利贴：{st.teacherTip}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};

/* ==========================================================================
   8. carousel_3d: 3D 环形分步停靠旋转展台 (video-shotcraft Carousel3D)
   ========================================================================== */
export const Carousel3DShowcaseScene: React.FC<{ title: string; data: any }> = ({
  title,
  data = {},
}) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const cards = data.cards || [
    {
      icon: "🔌",
      name: "/mem0-integrate",
      role: "一键装进你的项目",
      desc: "自动扫描你的代码是用什么框架写的，1 分钟帮你把记忆模块自动接好！",
      tag: "🔥 必装神技",
      color: "#fb7185",
    },
    {
      icon: "📝",
      name: "mem0-prompt-engineering",
      role: "教你写出满分提词",
      desc: "手把手教你定规矩：什么话该记、什么废话该扔，让记忆榨汁机更聪明！",
      tag: "👍 强烈推荐",
      color: "#38bdf8",
    },
    {
      icon: "🤖",
      name: "mem0-agent-integration",
      role: "连接 20+ 主流智能体",
      desc: "不管你用 LangGraph、CrewAI 还是 OpenAI SDK，插上就能让智能体共享记忆！",
      tag: "👍 生态互联",
      color: "#34d399",
    },
    {
      icon: "⚡",
      name: "mem0-vercel-ai-sdk",
      role: "前端网页聊天秒接入",
      desc: "做 Next.js 聊天网页时，不用自己写复杂后端，直接给聊天框加上长期记忆！",
      tag: "🧩 前端利器",
      color: "#c084fc",
    },
    {
      icon: "🛠️",
      name: "/mem0-doctor",
      role: "记忆体检与除错医生",
      desc: "要是发现记忆没存进去或者搜不出来，喊它一键体检就能找到病因！",
      tag: "🧩 排障神器",
      color: "#fbbf24",
    },
  ];

  const count = cards.length;
  const stepDeg = 360 / count;
  const segFrames = durationInFrames / count;
  const segIdx = Math.min(count - 1, Math.floor(f / segFrames));
  const segLocal = f - segIdx * segFrames;
  const moveFrames = segFrames * 0.55;
  const easeMove =
    segLocal < moveFrames
      ? Easing.inOut(Easing.cubic)(segLocal / Math.max(1, moveFrames))
      : 1;
  const ringYaw = -(segIdx + easeMove) * stepDeg;
  const radius = 440;

  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text, padding: "42px 80px 155px" }}>
      <PedagogicalHeader
        title={title}
        badge={data.badge || "生态百宝箱 · 3D 环形分步旋转展台"}
        analogySubtitle={
          data.subtitle || "除了核心引擎，官方还送了一整套“傻瓜式魔法插件”，转到哪张看哪张！"
        }
      />

      <div
        style={{
          flex: 1,
          position: "relative",
          perspective: "1800px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 430,
            height: 315,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `translateZ(-150px) rotateX(-7deg) rotateY(${ringYaw.toFixed(2)}deg)`,
          }}
        >
          {cards.map((c: any, i: number) => {
            const cardAngle = i * stepDeg;
            const normAngle = (((cardAngle + ringYaw) % 360) + 540) % 360 - 180;
            const frontFactor = Math.max(0, 1 - Math.abs(normAngle) / 90);
            const color = c.color || "#38bdf8";

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `rotateY(${cardAngle}deg) translateZ(${radius}px) scale(${
                    0.92 + 0.12 * frontFactor
                  })`,
                  background: "linear-gradient(155deg, rgba(15, 23, 42, 0.96), rgba(30, 27, 75, 0.94))",
                  border: `3px solid ${color}`,
                  borderRadius: 26,
                  padding: "24px 28px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: `0 22px 50px rgba(0,0,0,0.65), 0 0 ${24 + frontFactor * 36}px ${color}66`,
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        background: color,
                        color: "#0f172a",
                        fontSize: 17,
                        fontWeight: 900,
                        padding: "4px 14px",
                        borderRadius: 999,
                      }}
                    >
                      {c.tag}
                    </span>
                    <span style={{ fontSize: 34 }}>{c.icon}</span>
                  </div>

                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 23,
                      fontWeight: 900,
                      color: "#ffffff",
                      marginBottom: 6,
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color, marginBottom: 10 }}>
                    {c.role}
                  </div>
                  <div style={{ fontSize: 19, color: "#e2e8f0", lineHeight: 1.45 }}>{c.desc}</div>
                </div>

                <div
                  style={{
                    fontSize: 16,
                    fontFamily: MONO,
                    color: "#cbd5e1",
                    borderTop: "1px solid rgba(255,255,255,0.2)",
                    paddingTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>PLUGIN 0{i + 1} / 05</span>
                  <span style={{ color, fontWeight: 900 }}>READY ⚡</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TeacherChalkboardNote note={data.teacher_note} />
    </AbsoluteFill>
  );
};
