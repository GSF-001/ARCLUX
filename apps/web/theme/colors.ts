/**
 * Light mode color tokens.
 * Palette adapted from a Vercel-style minimal theme.
 * Maps to CSS variables consumed by Tailwind + shadcn components.
 */

export const colors = {
  palette: {
    neutral: "#FFFFFF",
    ink: "#171717",
    primary: "#0070F3",
    accent: "#8E4EC6",
    success: "#388E3C",
    warning: "#FF9500",
    error: "#DC3545",
    info: "#0070F3",
    diffAdd: "#46A758",
    diffDelete: "#E5484D",
  },

  /** Semantic tokens — mirrors shadcn's CSS variable naming */
  semantic: {
    background: "#FFFFFF",
    foreground: "#171717",

    card: "#FFFFFF",
    cardForeground: "#171717",

    popover: "#FFFFFF",
    popoverForeground: "#171717",

    primary: "#0070F3",
    primaryForeground: "#FFFFFF",

    secondary: "#F4F4F5",
    secondaryForeground: "#171717",

    muted: "#F4F4F5",
    mutedForeground: "#666666",

    accent: "#F4F4F5",
    accentForeground: "#171717",

    destructive: "#DC3545",
    destructiveForeground: "#FFFFFF",

    border: "#E5E5E5",
    input: "#E5E5E5",
    ring: "#0070F3",
  },

  syntax: {
    comment: "#888888",
    keyword: "#E93D82",
    string: "#46A758",
    primitive: "#8E4EC6",
    variable: "#0070F3",
    property: "#12A594",
    type: "#12A594",
    constant: "#FFB224",
    operator: "#E93D82",
    punctuation: "#171717",
  },
} as const

export type Colors = typeof colors
