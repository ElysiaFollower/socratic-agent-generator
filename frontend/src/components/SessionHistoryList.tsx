/**
 * Session history list component.
 *
 * This component renders the session list with rename/delete actions.
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
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Delete, Edit, Forum, MoreVert } from "@mui/icons-material";
import { SessionSummary } from "../types";
import { useConfirmDialog } from "../hooks";

/**
 * Props for SessionHistoryList component.
 */
export interface SessionHistoryListProps {
  readonly sessions: readonly SessionSummary[];
  readonly currentSessionId: string | null;
  readonly isLoading: boolean;
  readonly onNewSession: () => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onRenameSession: (sessionId: string, newName: string) => void;
  readonly onDeleteSession: (sessionId: string) => void;
}

/**
 * Session history list component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SessionHistoryList(
  props: SessionHistoryListProps,
): JSX.Element {
  const {
    sessions,
    currentSessionId,
    isLoading,
    onNewSession,
    onSelectSession,
    onRenameSession,
    onDeleteSession,
  } = props;
  const { confirm } = useConfirmDialog();

  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = React.useState<string>("");
  const [editingOriginalName, setEditingOriginalName] =
    React.useState<string>("");
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [menuSessionId, setMenuSessionId] = React.useState<string | null>(null);

  const handleRename = (sessionId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName === editingOriginalName) {
      setEditingSessionId(null);
      setEditingName("");
      setEditingOriginalName("");
      return;
    }
    onRenameSession(sessionId, trimmedName);
    setEditingSessionId(null);
    setEditingName("");
    setEditingOriginalName("");
  };

  const handleDelete = async (sessionId: string) => {
    const shouldDelete = await confirm({
      title: "删除会话",
      description: "确定要删除这个会话吗？该操作无法撤销。",
      confirmLabel: "删除",
      confirmColor: "error",
    });
    if (shouldDelete) {
      onDeleteSession(sessionId);
    }
  };

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    sessionId: string,
  ) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuSessionId(sessionId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuSessionId(null);
  };

  return (
    <Box>
      <Stack direction='row' alignItems='center' justifyContent='space-between'>
        <Typography
          variant='subtitle2'
          color='text.secondary'
          sx={{ px: 2, py: 1 }}
        >
          历史会话
        </Typography>
        <Tooltip title='新建对话'>
          <span>
            <IconButton
              onClick={onNewSession}
              size='small'
              aria-label='新建对话'
              disabled={isLoading}
              sx={{ mr: 1 }}
            >
              <Add fontSize='small' />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <List dense sx={{ display: "flex", flexDirection: "column", gap: 1, px: 1 }}>
        {sessions.map((session) => (
          <ListItem
            key={session.session_id}
            disablePadding
            sx={{
              border: "1px solid var(--color-border)",
              borderRadius: 1.5,
              "& .session-actions": {
                opacity: 0,
                transition: "opacity 150ms ease",
              },
              "&:hover .session-actions": { opacity: 1 },
            }}
            secondaryAction={
              <Stack direction='row' spacing={0.5} className='session-actions'>
                <Tooltip title='设置'>
                  <IconButton
                    size='small'
                    onClick={(event) =>
                      handleMenuOpen(event, session.session_id)
                    }
                  >
                    <MoreVert fontSize='small' />
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
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleRename(session.session_id, editingName);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setEditingSessionId(null);
                      setEditingName("");
                      setEditingOriginalName("");
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
            <Typography variant='caption'>点击上方按钮开始新的学习之旅</Typography>
          </Box>
        )}
      </List>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(event) => event.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            if (!menuSessionId) {
              return;
            }
            const session = sessions.find(
              (item) => item.session_id === menuSessionId,
            );
            if (!session) {
              return;
            }
            setEditingSessionId(session.session_id);
            setEditingName(session.session_name);
            setEditingOriginalName(session.session_name);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Edit fontSize='small' />
          </ListItemIcon>
          重命名
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!menuSessionId) {
              return;
            }
            handleMenuClose();
            handleDelete(menuSessionId);
          }}
        >
          <ListItemIcon>
            <Delete fontSize='small' color='error' />
          </ListItemIcon>
          删除
        </MenuItem>
      </Menu>
    </Box>
  );
}
