/**
 * Sidebar rail component for collapse control.
 *
 * This component renders a slim rail with a single toggle button.
 */

import React from 'react';
import {Box, IconButton, Tooltip} from '@mui/material';
import {ChevronLeft, ChevronRight} from '@mui/icons-material';

/**
 * Props for SidebarRail component.
 */
export interface SidebarRailProps {
  readonly isCollapsed: boolean;
  readonly onToggle: () => void;
}

/**
 * Sidebar rail component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SidebarRail(props: SidebarRailProps): JSX.Element {
  const {isCollapsed, onToggle} = props;

  return (
    <Box
      sx={{
        width: 48,
        bgcolor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1.5,
      }}
    >
      <Tooltip title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}>
        <IconButton onClick={onToggle} size="small">
          {isCollapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
