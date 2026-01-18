import { createTheme, PaletteMode } from "@mui/material/styles";

export const createAppTheme = (mode: PaletteMode) => {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: "#2563eb",
      },
      secondary: {
        main: "#3b82f6",
      },
      warning: {
        main: "#f97316",
      },
      background: {
        default: isDark ? "#040912" : "#f8fafc",
        paper: isDark ? "#111827" : "#ffffff",
      },
      text: {
        primary: isDark ? "#e2e8f0" : "#1e293b",
        secondary: isDark ? "#cbd5f5" : "#475569",
      },
      divider: isDark ? "#263043" : "#e2e8f0",
    },
    typography: {
      fontFamily: "var(--font-body)",
      h1: { fontFamily: "var(--font-heading)" },
      h2: { fontFamily: "var(--font-heading)" },
      h3: { fontFamily: "var(--font-heading)" },
      h4: { fontFamily: "var(--font-heading)" },
      h5: { fontFamily: "var(--font-heading)" },
      h6: { fontFamily: "var(--font-heading)" },
      subtitle1: { fontFamily: "var(--font-heading)" },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
        },
      },
    },
  });
};
