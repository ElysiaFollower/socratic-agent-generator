/**
 * Confirm dialog context for global confirmation usage.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  type ButtonProps,
} from "@mui/material";

export interface ConfirmDialogOptions {
  readonly title?: string;
  readonly description?: React.ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly confirmColor?: ButtonProps["color"];
}

interface ConfirmDialogContextValue {
  readonly confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmDialogContext = createContext<
  ConfirmDialogContextValue | undefined
>(undefined);

const DEFAULT_OPTIONS: Required<
  Pick<
    ConfirmDialogOptions,
    "title" | "confirmLabel" | "cancelLabel" | "confirmColor"
  >
> = {
  title: "确认操作",
  confirmLabel: "确认",
  cancelLabel: "取消",
  confirmColor: "primary",
};

interface ConfirmDialogProviderProps {
  readonly children: React.ReactNode;
}

export function ConfirmDialogProvider(
  props: ConfirmDialogProviderProps,
): JSX.Element {
  const { children } = props;
  const [state, setState] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({
        ...DEFAULT_OPTIONS,
        ...options,
      });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setState(null);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => handleClose(false)}
        fullWidth
        maxWidth='xs'
      >
        <DialogTitle>{state?.title ?? DEFAULT_OPTIONS.title}</DialogTitle>
        {state?.description ? (
          <DialogContent>
            {typeof state.description === "string" ? (
              <Typography variant='body2' color='text.secondary'>
                {state.description}
              </Typography>
            ) : (
              state.description
            )}
          </DialogContent>
        ) : null}
        <DialogActions>
          <Button onClick={() => handleClose(false)} color='inherit'>
            {state?.cancelLabel ?? DEFAULT_OPTIONS.cancelLabel}
          </Button>
          <Button
            onClick={() => handleClose(true)}
            variant='contained'
            color={state?.confirmColor ?? DEFAULT_OPTIONS.confirmColor}
          >
            {state?.confirmLabel ?? DEFAULT_OPTIONS.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog(): ConfirmDialogContextValue {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error(
      "useConfirmDialog must be used within ConfirmDialogProvider",
    );
  }
  return context;
}
