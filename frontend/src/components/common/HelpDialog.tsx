/**
 * Help dialog component for displaying user manuals.
 *
 * A reusable dialog component for showing help content with consistent styling.
 */

import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from "@mui/material";

/**
 * Props for HelpDialog component.
 */
export interface HelpDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly content: React.ReactNode;
}

/**
 * Help dialog component.
 *
 * @param props - Component props
 * @returns React component
 */
export function HelpDialog(props: HelpDialogProps): JSX.Element {
  const { open, onClose, title, content } = props;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ py: 1 }}>{content}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant='contained' color='primary'>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}
