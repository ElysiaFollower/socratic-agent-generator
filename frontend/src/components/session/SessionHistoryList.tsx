/**
 * Session history list component.
 *
 * This component renders the session list with rename/delete actions.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
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
import {
  Add,
  Close,
  Delete,
  Edit,
  Forum,
  MoreVert,
  PushPin,
  PushPinOutlined,
  Search,
  Wifi,
} from "@mui/icons-material";
import { SessionSummary } from "../../types";
import { useConfirmDialog } from "../../hooks";

// LocalStorage key for pinned sessions
const PINNED_SESSIONS_KEY = "pinned_sessions";

/**
 * Get pinned session IDs from localStorage
 */
function getPinnedSessionIds(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Set pinned session IDs to localStorage
 */
function savepinnedSessionIds(ids: string[]): void {
  localStorage.setItem(PINNED_SESSIONS_KEY, JSON.stringify(ids));
}

/**
 * Toggle pin state for a session
 */
function togglePinSession(sessionId: string): void {
  const pinned = getPinnedSessionIds();
  if (pinned.includes(sessionId)) {
    savepinnedSessionIds(pinned.filter((id) => id !== sessionId));
  } else {
    savepinnedSessionIds([...pinned, sessionId]);
  }
}

/**
 * Check if a session is pinned
 */
function isSessionPinned(sessionId: string): boolean {
  return getPinnedSessionIds().includes(sessionId);
}

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
  const { t } = useTranslation();
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
  const [searchModalOpen, setSearchModalOpen] = React.useState<boolean>(false);
  const [searchText, setSearchText] = React.useState<string>("");
  const [pinnedSessionIds, setPinnedSessionIds] = React.useState<string[]>(() =>
    getPinnedSessionIds(),
  );

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
      title: t("session.deleteSession"),
      description: t("session.deleteSessionConfirm"),
      confirmLabel: t("session.delete"),
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

  const handlePinToggle = (sessionId: string) => {
    togglePinSession(sessionId);
    setPinnedSessionIds(getPinnedSessionIds()); // 触发列表刷新
    handleMenuClose();
  };

  // Sort sessions: pinned sessions first, then others
  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aIsPinned = pinnedSessionIds.includes(a.session_id);
      const bIsPinned = pinnedSessionIds.includes(b.session_id);
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      return 0;
    });
  }, [sessions, pinnedSessionIds]);

  const isMenuSessionPinned = React.useMemo(() => {
    if (!menuSessionId) return false;
    return pinnedSessionIds.includes(menuSessionId);
  }, [menuSessionId, pinnedSessionIds]);

  // Filter sessions based on search text
  const filteredSessions = React.useMemo(() => {
    if (!searchText.trim()) {
      return sessions;
    }
    const query = searchText.trim().toLowerCase();
    return sessions.filter((session) => {
      return (
        session.session_name?.toLowerCase().includes(query) ||
        session.topic_name?.toLowerCase().includes(query)
      );
    });
  }, [sessions, searchText]);

  const handleSearchModalOpen = () => {
    setSearchModalOpen(true);
    setSearchText("");
  };

  const handleSearchModalClose = () => {
    setSearchModalOpen(false);
    setSearchText("");
  };

  const handleSearchResultClick = (session: SessionSummary) => {
    onSelectSession(session);
    handleSearchModalClose();
  };

  return (
    <Box>
      <Stack direction='row' alignItems='center' justifyContent='space-between'>
        <Typography
          variant='subtitle2'
          color='text.secondary'
          sx={{ px: 2, py: 1 }}
        >
          {t("session.historySessions")}
        </Typography>
        <Stack direction='row' spacing={0.5}>
          <Tooltip title={t("session.searchSessions")}>
            <span>
              <IconButton
                onClick={handleSearchModalOpen}
                size='small'
                aria-label={t("session.searchSessions")}
                disabled={isLoading}
              >
                <Search fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("session.newSession")}>
            <span>
              <IconButton
                onClick={onNewSession}
                size='small'
                aria-label={t("session.newSession")}
                disabled={isLoading}
              >
                <Add fontSize='small' />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
      <List
        dense
        sx={{ display: "flex", flexDirection: "column", gap: 1, px: 1 }}
      >
        {sortedSessions.map((session) => {
          const isPinned = pinnedSessionIds.includes(session.session_id);
          return (
            <ListItem
              key={session.session_id}
              disablePadding
              sx={{
                border: "1px solid var(--color-border)",
                borderRadius: 1.5,
                "& .pin-icon": {
                  opacity: isPinned ? 0.8 : 0,
                  transition: "opacity 150ms ease",
                },
                "& .session-actions": {
                  opacity: 0,
                  transition: "opacity 150ms ease",
                },
                "&:hover .pin-icon": { opacity: 0 },
                "&:hover .session-actions": { opacity: 1 },
              }}
              secondaryAction={
                <Box sx={{ position: "relative" }}>
                  {/* Pin icon - always visible when pinned */}
                  <Box className='pin-icon'>
                    <Tooltip title={t("session.pinned")}>
                      <IconButton
                        size='small'
                        onClick={(event) =>
                          handleMenuOpen(event, session.session_id)
                        }
                      >
                        <PushPin
                          fontSize='small'
                          sx={{ transform: "rotate(45deg)" }}
                        />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  {/* Settings button - visible on hover */}
                  <Stack
                    direction='row'
                    spacing={0.5}
                    className='session-actions'
                    sx={{ position: "absolute", top: 0, left: 0 }}
                  >
                    <Tooltip title={t("session.settings")}>
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
                </Box>
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
          );
        })}

        {sessions.length === 0 && (
          <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <Forum sx={{ fontSize: 36, color: "var(--color-border)" }} />
            <Typography variant='body2' sx={{ mt: 1 }}>
              {t("session.noSessions")}
            </Typography>
            <Typography variant='caption'>
              {t("session.startLearningJourney")}
            </Typography>
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
            handlePinToggle(menuSessionId);
          }}
        >
          <ListItemIcon>
            {isMenuSessionPinned ? (
              <PushPin fontSize='small' sx={{ transform: "rotate(45deg)" }} />
            ) : (
              <PushPinOutlined
                fontSize='small'
                sx={{ transform: "rotate(45deg)" }}
              />
            )}
          </ListItemIcon>
          {isMenuSessionPinned ? t("session.unpinned") : t("session.pinned")}
        </MenuItem>
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
          {t("session.rename")}
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
          {t("session.delete")}
        </MenuItem>
      </Menu>

      {/* Search Modal */}
      <Dialog
        open={searchModalOpen}
        onClose={handleSearchModalClose}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>
          <Stack direction='row' alignItems='center' spacing={1}>
            <Search fontSize='small' />
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              {t("session.searchSessions")}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("session.searchPlaceholder")}
              autoFocus
              fullWidth
              size='small'
              InputProps={{
                endAdornment: searchText && (
                  <IconButton
                    size='small'
                    onClick={() => setSearchText("")}
                    edge='end'
                  >
                    <Close fontSize='small' />
                  </IconButton>
                ),
              }}
            />
            <List dense sx={{ maxHeight: 400, overflowY: "auto" }}>
              {filteredSessions.length === 0 ? (
                <Box
                  sx={{ py: 4, textAlign: "center", color: "text.secondary" }}
                >
                  <Forum sx={{ fontSize: 32, color: "var(--color-border)" }} />
                  <Typography variant='body2' sx={{ mt: 1 }}>
                    {searchText
                      ? t("session.noSearchResults")
                      : t("session.noSessions")}
                  </Typography>
                </Box>
              ) : (
                filteredSessions.map((session) => (
                  <ListItem
                    key={session.session_id}
                    disablePadding
                    sx={{ mb: 0.5 }}
                  >
                    <ListItemButton
                      selected={currentSessionId === session.session_id}
                      onClick={() => handleSearchResultClick(session)}
                      sx={{
                        borderRadius: 1,
                        "&.Mui-selected": {
                          bgcolor: "rgba(37, 99, 235, 0.08)",
                        },
                      }}
                    >
                      <ListItemText
                        primary={session.session_name}
                        secondary={session.topic_name}
                        primaryTypographyProps={{
                          noWrap: true,
                          fontWeight: 600,
                        }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))
              )}
            </List>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
