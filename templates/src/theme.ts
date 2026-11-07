export const FONT = "'Microsoft YaHei', 'PingFang SC', 'Segoe UI', sans-serif";
export const MONO = "'JetBrains Mono', Consolas, 'Courier New', monospace";

export const COLORS = {
  bg: "#1e1b4b",
  panel: "rgba(30, 27, 75, 0.82)",
  border: "rgba(255, 255, 255, 0.24)",
  text: "#ffffff",
  sub: "#e0e7ff",
  accent: "#38bdf8",
  accent2: "#f472b6",
  gold: "#fbbf24",
  emerald: "#34d399",
  coral: "#fb7185",
};

export const TIERS: Record<string, { label: string; color: string; emoji: string }> = {
  must: { label: "必装", color: "#fb7185", emoji: "🔥" },
  recommended: { label: "推荐", color: "#fbbf24", emoji: "👍" },
  optional: { label: "#38bdf8", color: "#38bdf8", emoji: "🧩" },
};

export const tierOf = (t?: string) => TIERS[t || "optional"] || TIERS.optional;
