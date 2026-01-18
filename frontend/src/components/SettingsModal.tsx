/**
 * Mock settings modal.
 *
 * This component provides a placeholder settings UI.
 */

import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

/**
 * Props for SettingsModal component.
 */
export interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Settings modal component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SettingsModal(props: SettingsModalProps): JSX.Element | null {
  const {isOpen, onClose} = props;

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>设置</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            这是一个 mock 设置页，后续将替换为真实配置项。
          </Typography>
          <Paper variant="outlined" sx={{p: 2, borderStyle: 'dashed'}}>
            <Typography variant="subtitle2" sx={{mb: 1}}>
              偏好设置
            </Typography>
            <Typography variant="caption" color="text.secondary">
              可在此处添加通知、语言、快捷键等设置项。
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{p: 2, borderStyle: 'dashed'}}>
            <Typography variant="subtitle2" sx={{mb: 1}}>
              账户设置
            </Typography>
            <Typography variant="caption" color="text.secondary">
              可在此处添加邮箱、密码、权限等设置项。
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          完成
        </Button>
      </DialogActions>
    </Dialog>
  );
}
