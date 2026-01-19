/**
 * Header component for the main application header.
 *
 * This component displays session information and controls.
 */

import React from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Collapse,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  CloseFullscreen,
  ExpandLess,
  ExpandMore,
  Logout,
  MenuBookOutlined,
  OpenInFull,
  BadgeOutlined,
  Settings,
} from '@mui/icons-material';
import {SessionSummary, SocraticStep, ToolPanelView, User} from '../types';
import {ProgressBar} from './ProgressBar';

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
  readonly themeMode: 'light' | 'dark';
  readonly onToggleTheme: () => void;
  readonly onLogout: () => void;
  readonly onOpenSettings: () => void;
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
  } = props;

  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(menuAnchor);

  const displayName = user?.display_name || user?.username || '用户';
  const avatarLetter = displayName.trim().charAt(0).toUpperCase() || 'U';
  const avatarColors = [
    '#2563eb',
    '#0ea5e9',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#6366f1',
  ];
  const avatarBgColor =
    avatarColors[avatarLetter.charCodeAt(0) % avatarColors.length];

  const panelTitles: Record<ToolPanelView, string> = {
    chat: '苏格拉底式AI导师',
    invitation: '邀请码管理',
    'lab-manual': '实验文档管理',
    profile: 'Profile管理',
  };

  const displayTitle =
    activePanel === 'chat'
      ? currentSession?.session_name || panelTitles.chat
      : panelTitles[activePanel];

  const showSessionDetails = activePanel === 'chat' && Boolean(currentSession);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  return (
    <Box component="header" sx={{borderBottom: '1px solid var(--color-border)', bgcolor: 'var(--color-surface)'}}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{gap: 2, justifyContent: 'space-between'}}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6">{displayTitle}</Typography>
            {showSessionDetails && (
              <Tooltip title={isCollapsed ? '展开信息' : '收起信息'}>
                <IconButton onClick={onToggleCollapse} size="small">
                  {isCollapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {currentSession && (
              <Tooltip title={isMaximized ? '还原窗口' : '最大化对话'}>
                <IconButton onClick={onToggleMaximize}>
                  {isMaximized ? <CloseFullscreen /> : <OpenInFull />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={themeMode === 'dark' ? '切换为浅色' : '切换为深色'}>
              <IconButton onClick={onToggleTheme}>
                {themeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}
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
          <Box sx={{px: 3, pb: 2}}>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              sx={{mb: 2}}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{minWidth: 0}}>
                <Tooltip title="课程" arrow>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'var(--color-surface-muted)',
                      color: 'primary.main',
                    }}
                  >
                    <MenuBookOutlined fontSize="small" />
                  </Box>
                </Tooltip>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    maxWidth: '46vw',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentSession?.topic_name || '-'}
                </Typography>
              </Stack>
              <Divider orientation="vertical" flexItem />
              <Stack direction="row" spacing={1} alignItems="center" sx={{minWidth: 0}}>
                <Tooltip title="Profile" arrow>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: 'var(--color-surface-muted)',
                      color: 'secondary.main',
                    }}
                  >
                    <BadgeOutlined fontSize="small" />
                  </Box>
                </Tooltip>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {currentSession?.profile_id || '-'}
                </Typography>
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
        anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
        transformOrigin={{vertical: 'top', horizontal: 'right'}}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onOpenSettings();
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          设置
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onLogout();
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          登出
        </MenuItem>
      </Menu>
    </Box>
  );
}
