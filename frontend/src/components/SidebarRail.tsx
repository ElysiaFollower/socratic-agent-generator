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
  UploadFile,
} from "@mui/icons-material";
import { ToolPanelView } from "../types";
import { PermissionGuard } from "./PermissionGuard";

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
  readonly onOpenProfilePanel: () => void;
}

/**
 * Sidebar rail component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SidebarRail(props: SidebarRailProps): JSX.Element {
  const { isCollapsed, onToggle } = props;
  const {
    isLoading,
    activePanel,
    onOpenChatHome,
    onOpenInvitationPanel,
    onOpenLabManualPanel,
    onOpenProfilePanel,
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
        title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        placement='right'
      >
        <IconButton
          onClick={onToggle}
          size='small'
          aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
          sx={railButtonSx}
        >
          <ChevronRight fontSize='small' />
        </IconButton>
      </Tooltip>

      <Tooltip title='返回对话首页' placement='right'>
        <span>
          <IconButton
            onClick={onOpenChatHome}
            size='small'
            disabled={isLoading}
            aria-label='返回对话首页'
            color={activePanel === "chat" ? "primary" : "default"}
            sx={railButtonSx}
          >
            <HomeRounded fontSize='small' />
          </IconButton>
        </span>
      </Tooltip>

      <PermissionGuard requiredRoles={["admin", "teacher"]}>
        <Stack spacing={1} sx={{ mt: 2 }}>
          <Tooltip title='邀请码管理' placement='right'>
            <span>
              <IconButton
                onClick={onOpenInvitationPanel}
                size='small'
                disabled={isLoading}
                aria-label='邀请码管理'
                color={activePanel === "invitation" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <Key fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title='实验文档管理' placement='right'>
            <span>
              <IconButton
                onClick={onOpenLabManualPanel}
                size='small'
                disabled={isLoading}
                aria-label='实验文档管理上传实验文档'
                color={activePanel === "lab-manual" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <UploadFile fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title='Profile管理' placement='right'>
            <span>
              <IconButton
                onClick={onOpenProfilePanel}
                size='small'
                disabled={isLoading}
                aria-label='Profile管理'
                color={activePanel === "profile" ? "primary" : "default"}
                sx={railButtonSx}
              >
                <Description fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </PermissionGuard>
    </Box>
  );
}
