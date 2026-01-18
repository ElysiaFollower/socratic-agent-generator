/**
 * Sidebar component for session list and navigation.
 *
 * This component displays the list of sessions and provides
 * controls for creating new sessions and managing existing ones.
 */

import React from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Description,
  Edit,
  Key,
  Logout,
  UploadFile,
  Forum,
} from '@mui/icons-material';
import {SessionSummary, User} from '../types';
import {PermissionGuard} from './PermissionGuard';

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
  readonly onLogout: () => void;
  readonly onUploadLabManual?: () => void;
  readonly onGenerateProfile?: () => void;
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
    onLogout,
    onUploadLabManual,
    onGenerateProfile,
    className,
  } = props;

  const [editingSessionId, setEditingSessionId] = React.useState<
    string | null
  >(null);
  const [editingName, setEditingName] = React.useState<string>('');

  const handleRename = (sessionId: string, newName: string) => {
    if (newName.trim()) {
      onRenameSession(sessionId, newName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  const handleDelete = (sessionId: string) => {
    if (window.confirm('确定要删除这个会话吗？')) {
      onDeleteSession(sessionId);
    }
  };

  const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      teacher: '教师',
      student: '学生',
    };
    return roleMap[role] || role;
  };

  return (
    <Box
      className={className}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {user && (
        <Box sx={{p: 2, borderBottom: '1px solid var(--color-border)', bgcolor: 'var(--color-surface-muted)'}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{minWidth: 0}}>
              <Typography variant="subtitle2" noWrap>
                {user.display_name || user.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getRoleDisplayName(user.role)}
              </Typography>
            </Box>
            <Tooltip title="登出">
              <IconButton onClick={onLogout} size="small">
                <Logout fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      )}

      <PermissionGuard requiredRoles={['admin', 'teacher']}>
        <Box sx={{p: 2, borderBottom: '1px solid var(--color-border)', bgcolor: 'var(--color-surface-muted)'}}>
          <Typography variant="overline" color="text.secondary">
            {user?.role === 'admin' ? '管理员功能' : '教师功能'}
          </Typography>
          <Stack spacing={1} sx={{mt: 1}}>
            <Button
              onClick={() => {
                const event = new CustomEvent('openInvitationGenerator');
                window.dispatchEvent(event);
              }}
              variant="contained"
              startIcon={<Key />}
              disabled={isLoading}
            >
              生成邀请码
            </Button>
            <Button
              onClick={onUploadLabManual}
              variant="contained"
              startIcon={<UploadFile />}
              disabled={isLoading}
            >
              上传实验文档
            </Button>
            <Button
              onClick={onGenerateProfile}
              variant="contained"
              startIcon={<Description />}
              disabled={isLoading}
            >
              生成Profile
            </Button>
          </Stack>
        </Box>
      </PermissionGuard>

      <Box sx={{p: 2, borderBottom: '1px solid var(--color-border)'}}>
        <Button
          onClick={onNewSession}
          variant="contained"
          color="primary"
          fullWidth
          startIcon={<Add />}
          disabled={isLoading}
        >
          新建会话
        </Button>
      </Box>

      <Box sx={{flex: 1, overflowY: 'auto'}}>
        <Box sx={{p: 2}}>
          <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1}}>
            历史会话
          </Typography>
          <List dense sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
            {sessions.map((session) => (
              <ListItem
                key={session.session_id}
                disablePadding
                sx={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 2,
                  '& .session-actions': {opacity: 0, transition: 'opacity 150ms ease'},
                  '&:hover .session-actions': {opacity: 1},
                }}
                secondaryAction={
                  <Stack direction="row" spacing={0.5} className="session-actions">
                    <Tooltip title="重命名">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingSessionId(session.session_id);
                          setEditingName(session.session_name);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(session.session_id);
                        }}
                        color="error"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              >
                <ListItemButton
                  selected={currentSessionId === session.session_id}
                  onClick={() => onSelectSession(session)}
                  sx={{
                    borderRadius: 2,
                    alignItems: 'flex-start',
                    '&.Mui-selected': {
                      bgcolor: 'rgba(37, 99, 235, 0.08)',
                    },
                  }}
                >
                  {editingSessionId === session.session_id ? (
                    <TextField
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onBlur={() => handleRename(session.session_id, editingName)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleRename(session.session_id, editingName);
                        }
                      }}
                      size="small"
                      autoFocus
                      onClick={(event) => event.stopPropagation()}
                      fullWidth
                    />
                  ) : (
                    <ListItemText
                      primary={session.session_name}
                      secondary={session.topic_name}
                      primaryTypographyProps={{noWrap: true, fontWeight: 600}}
                      secondaryTypographyProps={{noWrap: true}}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            ))}

            {sessions.length === 0 && (
              <Box sx={{py: 6, textAlign: 'center', color: 'text.secondary'}}>
                <Forum sx={{fontSize: 36, color: 'var(--color-border)'}} />
                <Typography variant="body2" sx={{mt: 1}}>
                  还没有任何会话
                </Typography>
                <Typography variant="caption">
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
