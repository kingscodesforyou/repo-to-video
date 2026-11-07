export const FONT = "'Inter', 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif";
export const MONO = "'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace";

export interface GlobalArtDirection {
  aesthetic?: string;
  default_theme?: "dark_cinematic" | "light_editorial" | "mixed_editorial";
  palette?: {
    background_dark?: string;
    background_light?: string;
    surface_dark?: string;
    surface_light?: string;
    text_primary_dark?: string;
    text_primary_light?: string;
    muted?: string;
    primary_accent?: string;
  };
  lighting_preset?: "soft_studio" | "dramatic_rim" | "editorial_daylight";
  camera_philosophy?: string;
  max_element_budget?: number;
}

export interface SceneArtDirection {
  style?:
    | "premium_3d_editorial"
    | "light_editorial"
    | "dark_cinematic"
    | "product_demo"
    | "mechanism_3d"
    | string;
  theme?: "dark" | "light" | "dark_cinematic" | "light_editorial";
  lighting?: "soft_studio" | "dramatic_rim" | "editorial_daylight" | string;
  material?:
    | "translucent_glass"
    | "brushed_aluminum"
    | "matte_ceramic"
    | "anodized_dark"
    | "editorial_paper"
    | "authentic_screen"
    | string;
  accent_color?: string;
  element_budget?: number;
}

export interface ResolvedTheme {
  isLight: boolean;
  bg: string;
  bgSecondary: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  gridLine: string;
  shadowColor: string;
}

/**
 * v4 全局默认色板：Premium Editorial Tech Explainer
 * 摒弃高饱和宝蓝/紫罗兰塑料渐变，采用深邃碳黑 (#0B0D12) 与暖白编辑纸 (#F6F5F0)
 */
export const COLORS = {
  bg: "#0B0D12",
  bgLight: "#F6F5F0",
  panel: "rgba(19, 23, 34, 0.88)",
  border: "rgba(255, 255, 255, 0.14)",
  text: "#F3F4F6",
  sub: "#9CA3AF",
  accent: "#78A9FF",
  accent2: "#94A3B8",
  gold: "#F59E0B",
  emerald: "#34D399",
  coral: "#F43F5E",
};

export function resolveArtTheme(
  art?: SceneArtDirection,
  globalArt?: GlobalArtDirection
): ResolvedTheme {
  const style = art?.style || "premium_3d_editorial";
  const explicitTheme = art?.theme || globalArt?.default_theme || "dark_cinematic";
  const isLight =
    style === "light_editorial" ||
    explicitTheme === "light" ||
    explicitTheme === "light_editorial" ||
    art?.material === "editorial_paper";

  const accent = art?.accent_color || globalArt?.palette?.primary_accent || COLORS.accent;

  if (isLight) {
    return {
      isLight: true,
      bg: globalArt?.palette?.background_light || "#F6F5F0",
      bgSecondary: "#EAE8E0",
      surface: "rgba(255, 255, 255, 0.92)",
      surfaceElevated: "#FFFFFF",
      border: "rgba(17, 19, 24, 0.12)",
      borderStrong: "rgba(17, 19, 24, 0.24)",
      textPrimary: globalArt?.palette?.text_primary_light || "#111318",
      textSecondary: "#374151",
      textMuted: "#6B7280",
      accent,
      gridLine: "rgba(17, 19, 24, 0.05)",
      shadowColor: "rgba(17, 19, 24, 0.09)",
    };
  }

  return {
    isLight: false,
    bg: globalArt?.palette?.background_dark || "#0B0D12",
    bgSecondary: "#121621",
    surface: "rgba(19, 23, 34, 0.86)",
    surfaceElevated: "rgba(26, 32, 46, 0.94)",
    border: "rgba(255, 255, 255, 0.11)",
    borderStrong: "rgba(255, 255, 255, 0.22)",
    textPrimary: globalArt?.palette?.text_primary_dark || "#F3F4F6",
    textSecondary: "#CBD5E1",
    textMuted: "#64748B",
    accent,
    gridLine: "rgba(255, 255, 255, 0.038)",
    shadowColor: "rgba(0, 0, 0, 0.62)",
  };
}

export function resolveMaterialSurface(
  material: string = "translucent_glass",
  theme: ResolvedTheme,
  isFocal: boolean = true
): React.CSSProperties {
  const accent = theme.accent;
  const activeBorder = isFocal ? `${accent}AA` : theme.border;

  if (theme.isLight || material === "editorial_paper") {
    return {
      background: isFocal
        ? "linear-gradient(165deg, #FFFFFF 0%, #F9F8F5 100%)"
        : "rgba(255, 255, 255, 0.72)",
      border: `1.5px solid ${isFocal ? accent : theme.borderStrong}`,
      boxShadow: isFocal
        ? `0 20px 48px ${theme.shadowColor}, 0 0 0 1px ${accent}22`
        : `0 8px 24px ${theme.shadowColor}`,
    };
  }

  switch (material) {
    case "brushed_aluminum":
    case "anodized_dark":
      return {
        background: isFocal
          ? "linear-gradient(145deg, #222836 0%, #141822 52%, #1B202E 100%)"
          : "linear-gradient(145deg, #171B24 0%, #10131A 100%)",
        border: `1.5px solid ${activeBorder}`,
        boxShadow: isFocal
          ? `0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.18), 0 0 28px ${accent}26`
          : "0 12px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
      };
    case "matte_ceramic":
      return {
        background: isFocal
          ? "linear-gradient(160deg, #1E2433 0%, #151924 100%)"
          : "rgba(21, 25, 36, 0.75)",
        border: `1.5px solid ${activeBorder}`,
        boxShadow: isFocal
          ? `0 22px 50px rgba(0,0,0,0.65), 0 0 24px ${accent}20`
          : "0 10px 24px rgba(0,0,0,0.4)",
      };
    case "authentic_screen":
      return {
        background: "#0D1117",
        border: `1.5px solid ${isFocal ? accent : "rgba(255,255,255,0.16)"}`,
        boxShadow: `0 28px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)`,
      };
    case "translucent_glass":
    default:
      return {
        background: isFocal
          ? `linear-gradient(145deg, rgba(30, 38, 56, 0.78) 0%, rgba(17, 22, 34, 0.88) 100%)`
          : "rgba(17, 22, 34, 0.56)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1.5px solid ${activeBorder}`,
        boxShadow: isFocal
          ? `0 24px 56px rgba(0,0,0,0.62), inset 0 1px 1px rgba(255,255,255,0.22), 0 0 32px ${accent}22`
          : "0 12px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      };
  }
}

export const TIERS: Record<string, { label: string; color: string; emoji: string }> = {
  must: { label: "核心", color: "#F43F5E", emoji: "◆" },
  recommended: { label: "重点", color: "#F59E0B", emoji: "◇" },
  optional: { label: "扩展", color: "#78A9FF", emoji: "○" },
};

export const tierOf = (t?: string) => TIERS[t || "optional"] || TIERS.optional;
