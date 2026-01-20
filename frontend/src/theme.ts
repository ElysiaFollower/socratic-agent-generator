import { createTheme } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";

/**
 * Creates the application theme based on the design tokens.
 * This theme is synchronized with the CSS custom properties in globals.css.
 */
export const createAppTheme = (mode: PaletteMode) => {
  const isDark = mode === "dark";

  // Color definitions aligned with design tokens
  const colors = {
    // Primary colors (brand)
    primary: {
      main: "#2563eb", // --color-primary-600
      light: "#3b82f6", // --color-primary-500
      dark: "#1d4ed8", // --color-primary-700
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    },
    // Secondary colors (supporting brand)
    secondary: {
      main: "#0ea5e9", // --color-secondary-500
      light: "#38bdf8", // --color-secondary-400
      dark: "#0284c7", // --color-secondary-600
      50: "#f0f9ff",
      100: "#e0f2fe",
      200: "#bae6fd",
      300: "#7dd3fc",
      400: "#38bdf8",
      500: "#0ea5e9",
      600: "#0284c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
    },
    // Accent colors (highlights, CTAs)
    accent: {
      main: "#f97316", // --color-accent-500
      light: "#fb923c", // --color-accent-400
      dark: "#ea580c", // --color-accent-600
    },
    // Semantic colors
    success: {
      main: "#22c55e", // --color-success-500
      light: "#4ade80", // --color-success-400
      dark: "#16a34a", // --color-success-600
    },
    warning: {
      main: "#eab308", // --color-warning-500
      light: "#facc15", // --color-warning-400
      dark: "#ca8a04", // --color-warning-600
    },
    error: {
      main: "#ef4444", // --color-error-500
      light: "#f87171", // --color-error-400
      dark: "#dc2626", // --color-error-600
    },
    info: {
      main: "#3b82f6", // --color-info-500
      light: "#60a5fa", // --color-info-400
      dark: "#2563eb", // --color-info-600
    },
    // Neutral colors for backgrounds and surfaces
    neutral: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
  };

  return createTheme({
    palette: {
      mode,
      // Brand colors
      primary: {
        main: colors.primary.main,
        light: colors.primary.light,
        dark: colors.primary.dark,
        contrastText: "#ffffff",
      },
      secondary: {
        main: colors.secondary.main,
        light: colors.secondary.light,
        dark: colors.secondary.dark,
        contrastText: "#ffffff",
      },
      // Semantic colors
      success: {
        main: colors.success.main,
        light: colors.success.light,
        dark: colors.success.dark,
        contrastText: "#ffffff",
      },
      warning: {
        main: colors.warning.main,
        light: colors.warning.light,
        dark: colors.warning.dark,
        contrastText: "#000000",
      },
      error: {
        main: colors.error.main,
        light: colors.error.light,
        dark: colors.error.dark,
        contrastText: "#ffffff",
      },
      info: {
        main: colors.info.main,
        light: colors.info.light,
        dark: colors.info.dark,
        contrastText: "#ffffff",
      },
      // Background and surface colors
      background: {
        default: isDark ? colors.neutral[900] : colors.neutral[50],
        paper: isDark ? colors.neutral[800] : "#ffffff",
      },
      // Text colors
      text: {
        primary: isDark ? colors.neutral[100] : colors.neutral[800],
        secondary: isDark ? colors.neutral[300] : colors.neutral[600],
        disabled: isDark ? colors.neutral[400] : colors.neutral[400],
      },
      // Divider color
      divider: isDark ? colors.neutral[600] : colors.neutral[200],
      // Action colors (buttons, etc.)
      action: {
        active: isDark ? colors.neutral[300] : colors.neutral[600],
        hover: isDark ? `rgba(255, 255, 255, 0.08)` : `rgba(0, 0, 0, 0.04)`,
        selected: isDark ? `rgba(255, 255, 255, 0.16)` : `rgba(0, 0, 0, 0.08)`,
        disabled: isDark ? `rgba(255, 255, 255, 0.3)` : `rgba(0, 0, 0, 0.26)`,
        disabledBackground: isDark ? `rgba(255, 255, 255, 0.12)` : `rgba(0, 0, 0, 0.12)`,
      },
    },
    typography: {
      fontFamily: "var(--font-body)",
      fontSize: 14,
      h1: {
        fontFamily: "var(--font-heading)",
        fontSize: "2.25rem", // 36px
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: "-0.025em",
      },
      h2: {
        fontFamily: "var(--font-heading)",
        fontSize: "1.875rem", // 30px
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: "-0.025em",
      },
      h3: {
        fontFamily: "var(--font-heading)",
        fontSize: "1.5rem", // 24px
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: "-0.025em",
      },
      h4: {
        fontFamily: "var(--font-heading)",
        fontSize: "1.25rem", // 20px
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: "-0.025em",
      },
      h5: {
        fontFamily: "var(--font-heading)",
        fontSize: "1.125rem", // 18px
        fontWeight: 600,
        lineHeight: 1.5,
        letterSpacing: "-0.025em",
      },
      h6: {
        fontFamily: "var(--font-heading)",
        fontSize: "1rem", // 16px
        fontWeight: 600,
        lineHeight: 1.5,
        letterSpacing: "-0.025em",
      },
      subtitle1: {
        fontFamily: "var(--font-heading)",
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: "-0.025em",
      },
      subtitle2: {
        fontFamily: "var(--font-heading)",
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: "-0.025em",
      },
      body1: {
        fontFamily: "var(--font-body)",
        fontSize: "1rem",
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body2: {
        fontFamily: "var(--font-body)",
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: 1.5,
      },
      caption: {
        fontFamily: "var(--font-body)",
        fontSize: "0.75rem",
        fontWeight: 400,
        lineHeight: 1.5,
      },
      button: {
        fontFamily: "var(--font-body)",
        fontSize: "0.875rem",
        fontWeight: 600,
        lineHeight: 1.5,
        letterSpacing: "0.025em",
        textTransform: "none",
      },
    },
    shape: {
      borderRadius: 12, // --radius-xl (12px)
    },
    shadows: [
      "none",
      "var(--shadow-sm)",
      "var(--shadow-base)",
      "var(--shadow-md)",
      "var(--shadow-lg)",
      "var(--shadow-xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
      "var(--shadow-2xl)",
    ] as any,
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: "var(--radius-xl)",
            fontWeight: 600,
            padding: "var(--spacing-2) var(--spacing-4)",
            transition: "all var(--transition-duration-200) var(--transition-timing-default)",
          },
          contained: {
            "&:hover": {
              transform: "translateY(-1px)",
              boxShadow: "var(--shadow-md)",
            },
          },
          outlined: {
            borderWidth: "2px",
            "&:hover": {
              borderWidth: "2px",
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border)",
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border)",
            transition: "all var(--transition-duration-200) var(--transition-timing-default)",
            "&:hover": {
              boxShadow: "var(--shadow-md)",
              borderColor: "var(--color-primary-300)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: "var(--radius-lg)",
              transition: "all var(--transition-duration-200) var(--transition-timing-default)",
            },
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
        },
        styleOverrides: {
          tooltip: {
            borderRadius: "var(--radius-base)",
            fontSize: "0.75rem",
            fontWeight: 500,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: "var(--radius-full)",
            fontWeight: 500,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: "var(--color-border)",
          },
        },
      },
    },
  });
};
