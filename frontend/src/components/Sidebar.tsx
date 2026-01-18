/**
 * Sidebar component for session list and navigation.
 *
 * This component displays the list of sessions and provides
 * controls for creating new sessions and managing existing ones.
 */

import React from "react";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  ChevronLeft,
  Delete,
  Description,
  Edit,
  Key,
  UploadFile,
  Forum,
} from "@mui/icons-material";
import { alpha, Theme } from "@mui/material/styles";
import { SessionSummary, ToolPanelView, User } from "../types";
import { PermissionGuard } from "./PermissionGuard";

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
  readonly onOpenProfilePanel: () => void;
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
    onOpenProfilePanel,
    className,
  } = props;

  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = React.useState<string>("");

  const handleRename = (sessionId: string, newName: string) => {
    if (newName.trim()) {
      onRenameSession(sessionId, newName.trim());
    }
    setEditingSessionId(null);
    setEditingName("");
  };

  const handleDelete = (sessionId: string) => {
    if (window.confirm("确定要删除这个会话吗？")) {
      onDeleteSession(sessionId);
    }
  };

  const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: "管理员",
      teacher: "教师",
      student: "学生",
    };
    return roleMap[role] || role;
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
        bgcolor: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {user && (
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid var(--color-border)",
            bgcolor: "var(--color-surface-muted)",
          }}
        >
          <Stack
            direction='row'
            alignItems='center'
            justifyContent='space-between'
            spacing={1}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='subtitle2' noWrap>
                {user.display_name || user.username}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {getRoleDisplayName(user.role)}
              </Typography>
            </Box>
            <Tooltip title='收缩侧边栏'>
              <IconButton
                onClick={onCollapse}
                size='small'
                aria-label='收缩侧边栏'
              >
                <ChevronLeft fontSize='small' />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      <PermissionGuard requiredRoles={["admin", "teacher"]}>
        <Box
          sx={{
            p: 2,
            borderBottom: "1px solid var(--color-border)",
            bgcolor: "var(--color-surface-muted)",
          }}
        >
          <Typography variant='overline' color='text.secondary'>
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
                  primary='邀请码管理'
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
                  primary='上传实验文档'
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
                  primary='生成Profile'
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </PermissionGuard>

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        <Box sx={{ p: 2 }}>
          <Stack
            direction='row'
            alignItems='center'
            justifyContent='space-between'
            sx={{ mb: 1 }}
          >
            <Typography variant='subtitle2' color='text.secondary'>
              历史会话
            </Typography>
            <Tooltip title='新建对话'>
              <span>
                <IconButton
                  onClick={onNewSession}
                  size='small'
                  aria-label='新建对话'
                  disabled={isLoading}
                >
                  <Add fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <List dense sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {sessions.map((session) => (
              <ListItem
                key={session.session_id}
                disablePadding
                sx={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 1,
                  "& .session-actions": {
                    opacity: 0,
                    transition: "opacity 150ms ease",
                  },
                  "&:hover .session-actions": { opacity: 1 },
                }}
                secondaryAction={
                  <Stack
                    direction='row'
                    spacing={0.5}
                    className='session-actions'
                  >
                    <Tooltip title='重命名'>
                      <IconButton
                        size='small'
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingSessionId(session.session_id);
                          setEditingName(session.session_name);
                        }}
                      >
                        <Edit fontSize='small' />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title='删除'>
                      <IconButton
                        size='small'
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(session.session_id);
                        }}
                        color='error'
                      >
                        <Delete fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                <ListItemButton
                  selected={currentSessionId === session.session_id}
                  onClick={() => onSelectSession(session)}
                  sx={{
                    borderRadius: 1,
                    alignItems: "flex-start",
                    "&.Mui-selected": {
                      bgcolor: "rgba(37, 99, 235, 0.08)",
                    },
                  }}
                >
                  {editingSessionId === session.session_id ? (
                    <TextField
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onBlur={() =>
                        handleRename(session.session_id, editingName)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleRename(session.session_id, editingName);
                        }
                      }}
                      size='small'
                      autoFocus
                      onClick={(event) => event.stopPropagation()}
                      fullWidth
                    />
                  ) : (
                    <ListItemText
                      primary={session.session_name}
                      secondary={session.topic_name}
                      primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            ))}

            {sessions.length === 0 && (
              <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
                <Forum sx={{ fontSize: 36, color: "var(--color-border)" }} />
                <Typography variant='body2' sx={{ mt: 1 }}>
                  还没有任何会话
                </Typography>
                <Typography variant='caption'>
                  点击上方按钮开始新的学习之旅
                </Typography>
              </Box>
            )}
          </List>
        </Box>
      </Box>
    </Box>
  );
}
