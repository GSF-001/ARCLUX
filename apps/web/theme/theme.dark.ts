/**
 * Dark mode color tokens.
 * Palette adapted from a Vercel-style minimal theme.
 * Maps to CSS variables consumed by Tailwind + shadcn components.
 */

export const darkColors = {
  palette: {
    neutral: "#000000",
    ink: "#EDEDED",
    primary: "#0070F3",
    accent: "#8E4EC6",
    success: "#46A758",
    warning: "#FFB224",
    error: "#E5484D",
    info: "#52A8FF",
    diffAdd: "#63C46D",
    diffDelete: "#FF6166",
  },

  semantic: {
    background: "#000000",
    foreground: "#EDEDED",

    card: "#0A0A0A",
    cardForeground: "#EDEDED",

    popover: "#0A0A0A",
    popoverForeground: "#EDEDED",

    primary: "#0070F3",
    primaryForeground: "#FFFFFF",

    secondary: "#1A1A1A",
    secondaryForeground: "#EDEDED",

    muted: "#1A1A1A",
    mutedForeground: "#878787",

    accent: "#1A1A1A",
    accentForeground: "#EDEDED",

    destructive: "#E5484D",
    destructiveForeground: "#FFFFFF",

    border: "#2E2E2E",
    input: "#2E2E2E",
    ring: "#0070F3",
  },

  syntax: {
    comment: "#878787",
    keyword: "#F75590",
    string: "#63C46D",
    primitive: "#BF7AF0",
    variable: "#52A8FF",
    property: "#0AC7AC",
    type: "#0AC7AC",
    constant: "#F2A700",
    operator: "#F75590",
    punctuation: "#EDEDED",
  },
} as const

export type DarkColors = typeof darkColors
