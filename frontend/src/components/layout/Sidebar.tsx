/**
 * Sidebar component for session list and navigation.
 *
 * This component displays the list of sessions and provides
 * controls for creating new sessions and managing existing ones.
 */

import React from "react";
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AdminPanelSettings,
  ChevronLeft,
  Description,
  Key,
  PersonOutline,
  School,
  UploadFile,
  Extension,
} from "@mui/icons-material";
import { alpha, Theme } from "@mui/material/styles";
import { SessionSummary, ToolPanelView, User } from "../../types";
import { PermissionGuard } from "../auth/PermissionGuard";
import { SessionHistoryList } from "../session/SessionHistoryList";

/**
 * Props for Sidebar component.
 */
export interface SidebarProps {
  readonly sessions: readonly SessionSummary[];
  readonly currentSessionId: string | null;
  readonly isLoading: boolean;
  readonly onNewSession: () => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onRenameSession: (sessionId: string, newName: string) => void;
  readonly onDeleteSession: (sessionId: string) => void;
  readonly user: User | null;
  readonly activePanel: ToolPanelView;
  readonly onCollapse: () => void;
  readonly onOpenInvitationPanel: () => void;
  readonly onOpenLabManualPanel: () => void;
  readonly onOpenSkillPanel: () => void;
  readonly onOpenProfilePanel: () => void;
  readonly onOpenClassPanel: () => void;
  readonly className?: string;
}

/**
 * Sidebar component for session management.
 *
 * @param props - Component props
 * @returns React component
 */
export function Sidebar(props: SidebarProps): JSX.Element {
  const {
    sessions,
    currentSessionId,
    isLoading,
    onNewSession,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
    user,
    activePanel,
    onCollapse,
    onOpenInvitationPanel,
    onOpenLabManualPanel,
    onOpenSkillPanel,
    onOpenProfilePanel,
    onOpenClassPanel,
    className,
  } = props;

  const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: "管理员",
      teacher: "教师",
      student: "学生",
    };
    return roleMap[role] || role;
  };

  const getRoleIcon = (role: string): JSX.Element => {
    if (role === "admin") {
      return <AdminPanelSettings fontSize='small' />;
    }
    if (role === "teacher") {
      return <School fontSize='small' />;
    }
    return <PersonOutline fontSize='small' />;
  };

  const actionItemSx = (theme: Theme) => {
    const hoverBg = alpha(
      theme.palette.text.primary,
      theme.palette.mode === "dark" ? 0.12 : 0.06,
    );

    return {
      borderRadius: 2,
      px: 1.5,
      py: 1,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "flex-start",
      textAlign: "left",
      transition: "background-color 150ms ease, color 150ms ease",
      "& .MuiListItemIcon-root": {
        minWidth: 32,
        color: "text.secondary",
      },
      "&:hover": { bgcolor: hoverBg },
      "&.Mui-selected": {
        bgcolor: hoverBg,
        "& .MuiListItemText-primary": { fontWeight: 600 },
        "& .MuiListItemIcon-root": { color: "text.primary" },
      },
      "&.Mui-selected:hover": { bgcolor: hoverBg },
    } as const;
  };

  return (
    <Box
      className={className}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "var(--color-surface-muted)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {user && (
        <Box
          sx={{
            p: 1,
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Stack
            direction='row'
            alignItems='center'
            justifyContent='space-between'
            spacing={1}
          >
            <Stack
              direction='row'
              alignItems='center'
              spacing={1}
              sx={{ minWidth: 0 }}
            >
              <Tooltip title={getRoleDisplayName(user.role)}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: "text.secondary",
                  }}
                >
                  {getRoleIcon(user.role)}
                </Box>
              </Tooltip>
              <Typography variant='subtitle2' noWrap>
                {user.display_name || user.username}
              </Typography>
            </Stack>
            <Tooltip title='收缩侧边栏'>
              <IconButton
                onClick={onCollapse}
                size='small'
                aria-label='收缩侧边栏'
                sx={{ mr: 1 }}
              >
                <ChevronLeft fontSize='small' />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      <Box
        sx={{
          p: 2,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Typography color='text.secondary' variant='subtitle2'>
          班级
        </Typography>
        <List
          dense
          disablePadding
          sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
        >
          <ListItem disablePadding>
            <ListItemButton
              onClick={onOpenClassPanel}
              disabled={isLoading}
              selected={activePanel === "class"}
              disableRipple
              sx={actionItemSx}
            >
              <ListItemIcon>
                <School fontSize='small' />
              </ListItemIcon>
              <ListItemText
                primary='我的班级'
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <PermissionGuard requiredRoles={["admin", "teacher"]}>
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <Typography color='text.secondary' variant='subtitle2'>
            {user?.role === "admin" ? "管理员功能" : "教师功能"}
          </Typography>
          <List
            dense
            disablePadding
            sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
          >
            <ListItem disablePadding>
              <ListItemButton
                onClick={onOpenInvitationPanel}
                disabled={isLoading}
                selected={activePanel === "invitation"}
                disableRipple
                sx={actionItemSx}
              >
                <ListItemIcon>
                  <Key fontSize='small' />
                </ListItemIcon>
                <ListItemText
                  primary='班级邀请码'
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={onOpenLabManualPanel}
                disabled={isLoading}
                selected={activePanel === "lab-manual"}
                disableRipple
                sx={actionItemSx}
              >
                <ListItemIcon>
                  <UploadFile fontSize='small' />
                </ListItemIcon>
                <ListItemText
                  primary='实验文档管理'
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={onOpenSkillPanel}
                disabled={isLoading}
                selected={activePanel === "skill"}
                disableRipple
                sx={actionItemSx}
              >
                <ListItemIcon>
                  <Extension fontSize='small' />
                </ListItemIcon>
                <ListItemText
                  primary='Skill管理'
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={onOpenProfilePanel}
                disabled={isLoading}
                selected={activePanel === "profile"}
                disableRipple
                sx={actionItemSx}
              >
                <ListItemIcon>
                  <Description fontSize='small' />
                </ListItemIcon>
                <ListItemText
                  primary='Profile管理'
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </PermissionGuard>

      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
        }}
      >
        <SessionHistoryList
          sessions={sessions}
          currentSessionId={currentSessionId}
          isLoading={isLoading}
          onNewSession={onNewSession}
          onSelectSession={onSelectSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
        />
      </Box>
    </Box>
  );
}
