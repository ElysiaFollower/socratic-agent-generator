/**
 * Notification context for global snackbar usage.
 *
 * Provides a thin wrapper around notistack with convenience helpers.
 */

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";
import {
  SnackbarProvider,
  useSnackbar,
  type OptionsObject,
  type SnackbarKey,
  type VariantType,
} from "notistack";

export type NotificationOptions = OptionsObject;

interface NotificationContextValue {
  readonly notify: (
    message: string,
    options?: NotificationOptions,
  ) => SnackbarKey;
  readonly notifySuccess: (
    message: string,
    options?: NotificationOptions,
  ) => SnackbarKey;
  readonly notifyError: (
    message: string,
    options?: NotificationOptions,
  ) => SnackbarKey;
  readonly notifyInfo: (
    message: string,
    options?: NotificationOptions,
  ) => SnackbarKey;
  readonly notifyWarning: (
    message: string,
    options?: NotificationOptions,
  ) => SnackbarKey;
  readonly closeNotification: (key?: SnackbarKey) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

interface NotificationProviderProps {
  readonly children: React.ReactNode;
}

function NotificationContextBridge(
  props: NotificationProviderProps,
): JSX.Element {
  const { children } = props;
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const notify = useCallback(
    (message: string, options?: NotificationOptions) =>
      enqueueSnackbar(message, {
        ...options,
        action:
          options?.action ??
          ((key) => (
            <IconButton
              size='small'
              aria-label={t("notification.close")}
              onClick={() => closeSnackbar(key)}
            >
              <Close fontSize='small' />
            </IconButton>
          )),
      }),
    [enqueueSnackbar, closeSnackbar, t],
  );

  const createNotifier = useCallback(
    (variant: VariantType) =>
      (message: string, options?: NotificationOptions) =>
        notify(message, { ...options, variant }),
    [notify],
  );

  const value = useMemo(
    () => ({
      notify,
      notifySuccess: createNotifier("success"),
      notifyError: createNotifier("error"),
      notifyInfo: createNotifier("info"),
      notifyWarning: createNotifier("warning"),
      closeNotification: closeSnackbar,
    }),
    [notify, createNotifier, closeSnackbar],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function NotificationProvider(
  props: NotificationProviderProps,
): JSX.Element {
  const { children } = props;

  return (
    <SnackbarProvider
      maxSnack={3}
      autoHideDuration={3200}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      preventDuplicate
      dense
    >
      <NotificationContextBridge>{children}</NotificationContextBridge>
    </SnackbarProvider>
  );
}

export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
}
