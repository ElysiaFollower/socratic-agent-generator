/**
 * Main application component.
 *
 * This component sets up routing and global theming.
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Box, CssBaseline, ThemeProvider, Typography } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components";
import { NotificationProvider } from "./contexts/NotificationContext";
import { ConfirmDialogProvider } from "./contexts/ConfirmDialogContext";
import { useAuth } from "./hooks";
import { createAppTheme } from "./theme";
import { useTranslation } from "react-i18next";

// Lazy load pages for code splitting
const ChatPage = lazy(() =>
  import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("./pages/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);

/**
 * Main App component.
 *
 * @returns React component
 */
export default function App(): JSX.Element {
  const { i18n } = useTranslation();
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const stored = window.localStorage.getItem("theme-mode");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  });
  const theme = useMemo(
    () => createAppTheme(themeMode, i18n.language),
    [themeMode, i18n.language],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeMode);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme-mode", themeMode);
    }
  }, [themeMode]);

  const handleToggleTheme = () => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <ConfirmDialogProvider>
          <Suspense
            fallback={
              <Box
                sx={{
                  display: "flex",
                  minHeight: "100vh",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography color='text.secondary'>加载页面中...</Typography>
              </Box>
            }
          >
            <Routes>
              <Route path='/' element={<AuthRedirect />} />
              <Route path='/login' element={<LoginPage />} />
              <Route path='/register' element={<RegisterPage />} />
              <Route
                path='/app'
                element={
                  <ProtectedRoute redirectTo='/login'>
                    <ChatPage
                      themeMode={themeMode}
                      onToggleTheme={handleToggleTheme}
                    />
                  </ProtectedRoute>
                }
              />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          </Suspense>
        </ConfirmDialogProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

function AuthRedirect(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color='text.secondary'>加载中...</Typography>
      </Box>
    );
  }

  return <Navigate to={isAuthenticated ? "/app" : "/login"} replace />;
}
