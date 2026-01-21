/**
 * Sidebar rail component for collapse control.
 *
 * This component renders a slim rail with a single toggle button.
 */

import React from "react";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import {
  ChevronRight,
  Description,
  HomeRounded,
  Key,
  School,
  UploadFile,
  Extension,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { ToolPanelView } from "../../types";
import { PermissionGuard } from "../auth/PermissionGuard";

/**
 * Props for SidebarRail component.
 */
export interface SidebarRailProps {
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
  readonly isLoading: boolean;
  readonly activePanel: ToolPanelView;
  readonly onOpenChatHome: () => void;
  readonly onOpenInvitationPanel: () => void;
  readonly onOpenLabManualPanel: () => void;
  readonly onOpenSkillPanel: () => void;
  readonly onOpenProfilePanel: () => void;
  readonly onOpenClassPanel: () => void;
}

/**
 * Sidebar rail component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SidebarRail(props: SidebarRailProps): JSX.Element {
  const { t } = useTranslation();
  const { isCollapsed, onToggle } = props;
  const {
    isLoading,
    activePanel,
    onOpenChatHome,
    onOpenInvitationPanel,
    onOpenLabManualPanel,
    onOpenSkillPanel,
    onOpenProfilePanel,
    onOpenClassPanel,
  } = props;

  const railButtonSx = {
    borderRadius: 2,
    width: 40,
    height: 40,
    transition: "background-color 150ms ease, color 150ms ease",
    "&:hover": { bgcolor: "var(--color-surface)" },
  } as const;

  return (
    <Box
      sx={{
        width: 48,
        bgcolor: "var(--color-surface-muted)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 1,
      }}
    >
      <Tooltip
        title={isCollapsed ? t("sidebar.rail.expandSidebar") : t("sidebar.rail.collapseSidebar")}
        placement='right'
      >
        <IconButton
          onClick={onToggle}
          size='small'
          aria-label={isCollapsed ? t("sidebar.rail.expandSidebar") : t("sidebar.rail.collapseSidebar")}
          sx={railButtonSx}
        >
          <ChevronRight fontSize='small' />
        </IconButton>
      </Tooltip>

      <Tooltip title={t("sidebar.rail.returnToChatHome")} placement='right'>
        <span>
          <IconButton
            onClick={onOpenChatHome}
            size='small'
            disabled={isLoading}
            aria-label={t("sidebar.rail.returnToChatHome")}
            color={activePanel === "chat" ? "primary" : "default"}
            sx={railButtonSx}
          >
            <HomeRounded fontSize='small' />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={t("sidebar.rail.myClasses")} placement='right'>
        <span>
          <IconButton
            onClick={onOpenClassPanel}
            size='small'
            disabled={isLoading}
            aria-label={t("sidebar.rail.myClasses")}
            color={activePanel === "class" ? "primary" : "default"}
            sx={railButtonSx}
          >
            <School fontSize='small' />
          </IconButton>
        </span>
      </Tooltip>

      <PermissionGuard requiredRoles={["admin", "teacher"]}>
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Tooltip title={t("sidebar.rail.registrationInviteCode")} placement='right'>
            <span>
              <IconButton
                onClick={onOpenInvitationPanel}
                size='small'
                disabled={isLoading}
                aria-label={t("sidebar.rail.registrationInviteCode")}
                color={activePanel === "invitation" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <Key fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("sidebar.rail.labManual")} placement='right'>
            <span>
              <IconButton
                onClick={onOpenLabManualPanel}
                size='small'
                disabled={isLoading}
                aria-label={t("sidebar.rail.labManual")}
                color={activePanel === "lab-manual" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <UploadFile fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("sidebar.rail.profileManagement")} placement='right'>
            <span>
              <IconButton
                onClick={onOpenProfilePanel}
                size='small'
                disabled={isLoading}
                aria-label={t("sidebar.rail.profileManagement")}
                color={activePanel === "profile" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <Description fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("sidebar.rail.skillManagement")} placement='right'>
            <span>
              <IconButton
                onClick={onOpenSkillPanel}
                size='small'
                disabled={isLoading}
                aria-label={t("sidebar.rail.skillManagement")}
                color={activePanel === "skill" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <Extension fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </PermissionGuard>
    </Box>
  );
}
