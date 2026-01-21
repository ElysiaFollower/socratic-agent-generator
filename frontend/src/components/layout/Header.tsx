/**
 * Header component for the main application header.
 *
 * This component displays session information and controls.
 */

import React from "react";
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Brightness4,
  Brightness7,
  CloseFullscreen,
  ExpandLess,
  ExpandMore,
  HelpOutline,
  Logout,
  MenuBookOutlined,
  OpenInFull,
  BadgeOutlined,
  Settings,
  Translate,
} from "@mui/icons-material";
import { SessionSummary, SocraticStep, ToolPanelView, User } from "../../types";
import { ProgressBar } from "../chat/ProgressBar";
import { HelpDialog } from "../common/HelpDialog";
import {
  LabManualHelpContent,
  ProfileManagerHelpContent,
  SkillManagerHelpContent,
} from "../common/HelpContent";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "../../i18n";

/**
 * Props for Header component.
 */
export interface HeaderProps {
  readonly currentSession: SessionSummary | null;
  readonly isMaximized: boolean;
  readonly isCollapsed: boolean;
  readonly currentStep: number;
  readonly curriculum: readonly SocraticStep[];
  readonly isProgressLoading: boolean;
  readonly onToggleMaximize: () => void;
  readonly onToggleCollapse: () => void;
  readonly activePanel: ToolPanelView;
  readonly user: User | null;
  readonly themeMode: "light" | "dark";
  readonly onToggleTheme: () => void;
  readonly onLogout: () => void;
  readonly onOpenSettings: () => void;
  readonly onProfileClick?: () => void;
  readonly currentLanguage?: SupportedLanguage;
  readonly onLanguageChange?: (language: SupportedLanguage) => void;
}

/**
 * Header component for the main application header.
 *
 * @param props - Component props
 * @returns React component
 */
export function Header(props: HeaderProps): JSX.Element {
  const {
    currentSession,
    isMaximized,
    isCollapsed,
    currentStep,
    curriculum,
    isProgressLoading,
    onToggleMaximize,
    onToggleCollapse,
    activePanel,
    user,
    themeMode,
    onToggleTheme,
    onLogout,
    onOpenSettings,
    onProfileClick,
    currentLanguage,
    onLanguageChange,
  } = props;

  const { t, i18n } = useTranslation();

  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(menuAnchor);
  const [helpDialogOpen, setHelpDialogOpen] = React.useState<boolean>(false);
  const [languageMenuAnchor, setLanguageMenuAnchor] =
    React.useState<HTMLElement | null>(null);
  const isLanguageMenuOpen = Boolean(languageMenuAnchor);

  const displayName = user?.display_name || user?.username || t("header.user");
  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || "U";
  const avatarColors = [
    "#2563eb",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#6366f1",
  ];
  const avatarBgColor =
    avatarColors[avatarLetter.charCodeAt(0) % avatarColors.length];

  const panelTitles: Record<ToolPanelView, string> = {
    chat: t("header.panelTitles.chat"),
    invitation: t("header.panelTitles.invitation"),
    "lab-manual": t("header.panelTitles.lab-manual"),
    skill: t("header.panelTitles.skill"),
    profile: t("header.panelTitles.profile"),
    class: t("header.panelTitles.class"),
  };

  const displayTitle =
    activePanel === "chat"
      ? currentSession?.session_name || panelTitles.chat
      : panelTitles[activePanel];

  const showSessionDetails = activePanel === "chat" && Boolean(currentSession);

  const showHelpButton =
    activePanel === "lab-manual" ||
    activePanel === "profile" ||
    activePanel === "skill";

  const helpDialogTitle: Record<ToolPanelView, string> = {
    chat: "",
    invitation: "",
    "lab-manual": t("header.helpTitles.lab-manual"),
    skill: t("header.helpTitles.skill"),
    profile: t("header.helpTitles.profile"),
    class: "",
  };

  const getHelpContent = (): React.ReactNode => {
    switch (activePanel) {
      case "lab-manual":
        return <LabManualHelpContent />;
      case "profile":
        return <ProfileManagerHelpContent />;
      case "skill":
        return <SkillManagerHelpContent />;
      default:
        return null;
    }
  };

  const handleLanguageMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageMenuAnchor(event.currentTarget);
  };

  const handleLanguageMenuClose = () => {
    setLanguageMenuAnchor(null);
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    onLanguageChange?.(lang);
    handleLanguageMenuClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <Box
      component='header'
      sx={{
        borderBottom: "1px solid var(--color-border)",
        bgcolor: "var(--color-surface)",
      }}
    >
      <AppBar position='static' color='transparent' elevation={0}>
        <Toolbar sx={{ gap: 2, justifyContent: "space-between" }}>
          <Stack direction='row' alignItems='center' spacing={2}>
            <Typography variant='h6'>{displayTitle}</Typography>
            {showHelpButton && (
              <Tooltip title={t("header.tooltips.userGuide")}>
                <IconButton
                  size='small'
                  onClick={() => setHelpDialogOpen(true)}
                  aria-label={t("header.tooltips.userGuide")}
                >
                  <HelpOutline fontSize='small' />
                </IconButton>
              </Tooltip>
            )}
            {showSessionDetails && (
              <Tooltip
                title={
                  isCollapsed
                    ? t("header.tooltips.expandInfo")
                    : t("header.tooltips.collapseInfo")
                }
              >
                <IconButton onClick={onToggleCollapse} size='small'>
                  {isCollapsed ? (
                    <ExpandMore fontSize='small' />
                  ) : (
                    <ExpandLess fontSize='small' />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Stack direction='row' spacing={1} alignItems='center'>
            {currentSession && (
              <Tooltip
                title={
                  isMaximized
                    ? t("header.tooltips.restoreWindow")
                    : t("header.tooltips.maximizeChat")
                }
              >
                <IconButton onClick={onToggleMaximize}>
                  {isMaximized ? <CloseFullscreen /> : <OpenInFull />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip
              title={
                themeMode === "dark"
                  ? t("header.tooltips.switchToLight")
                  : t("header.tooltips.switchToDark")
              }
            >
              <IconButton onClick={onToggleTheme}>
                {themeMode === "dark" ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Tooltip>
            <Tooltip title={t("language.switch")}>
              <IconButton onClick={handleLanguageMenuOpen}>
                <Translate />
              </IconButton>
            </Tooltip>
            <Tooltip title={displayName}>
              <IconButton onClick={handleMenuOpen}>
                <Avatar
                  sx={{
                    bgcolor: avatarBgColor,
                    width: 36,
                    height: 36,
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {avatarLetter}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {showSessionDetails && (
        <Collapse in={!isCollapsed} timeout={200}>
          <Box sx={{ px: 3, py: 2 }}>
            <Stack
              direction='row'
              spacing={2}
              alignItems='center'
              flexWrap='wrap'
              sx={{ mb: 2 }}
            >
              <Stack
                direction='row'
                spacing={1}
                alignItems='center'
                sx={{ minWidth: 0 }}
              >
                <Tooltip title={t("header.tooltips.curriculum")} arrow>
                  <Box
                    component='span'
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      bgcolor: "var(--color-surface-muted)",
                      color: "primary.main",
                    }}
                  >
                    <MenuBookOutlined fontSize='small' />
                  </Box>
                </Tooltip>
                <Typography
                  variant='body2'
                  sx={{
                    fontWeight: 600,
                    color: "text.primary",
                    maxWidth: "46vw",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentSession?.topic_name || "-"}
                </Typography>
              </Stack>
              <Divider orientation='vertical' flexItem />
              <Stack
                direction='row'
                spacing={1}
                alignItems='center'
                sx={{ minWidth: 0 }}
              >
                <Tooltip title={t("header.tooltips.profile")} arrow>
                  <Box
                    component='span'
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      bgcolor: "var(--color-surface-muted)",
                      color: "secondary.main",
                    }}
                  >
                    <BadgeOutlined fontSize='small' />
                  </Box>
                </Tooltip>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: onProfileClick ? "pointer" : "default",
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    transition: "background-color 150ms ease, color 150ms ease",
                    "&:hover": onProfileClick
                      ? {
                          backgroundColor: "var(--color-surface-muted)",
                          "& .MuiTypography-root": {
                            color: "primary.main",
                          },
                        }
                      : {},
                  }}
                  onClick={onProfileClick}
                >
                  <Typography
                    variant='body2'
                    sx={{
                      fontWeight: 600,
                      fontFamily: "var(--font-mono)",
                      color: "text.primary",
                    }}
                  >
                    {currentSession?.profile_name || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
            <ProgressBar
              currentStep={currentStep}
              curriculum={curriculum}
              isLoading={isProgressLoading}
            />
          </Box>
        </Collapse>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={isMenuOpen}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onOpenSettings();
          }}
        >
          <ListItemIcon>
            <Settings fontSize='small' />
          </ListItemIcon>
          <ListItemText>{t("header.menu.settings")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onLogout();
          }}
        >
          <ListItemIcon>
            <Logout fontSize='small' />
          </ListItemIcon>
          <ListItemText>{t("header.menu.logout")}</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={languageMenuAnchor}
        open={isLanguageMenuOpen}
        onClose={handleLanguageMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {(Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]).map(
          (lang) => (
            <MenuItem
              key={lang}
              selected={i18n.language === lang}
              onClick={() => handleLanguageChange(lang)}
            >
              <ListItemText>
                {SUPPORTED_LANGUAGES[lang].displayName}
              </ListItemText>
            </MenuItem>
          ),
        )}
      </Menu>

      {showHelpButton && (
        <HelpDialog
          open={helpDialogOpen}
          onClose={() => setHelpDialogOpen(false)}
          title={helpDialogTitle[activePanel]}
          content={getHelpContent()}
        />
      )}
    </Box>
  );
}
