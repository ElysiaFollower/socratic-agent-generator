/**
 * Clipboard hook for copying text to clipboard.
 *
 * This hook provides a convenient way to copy text to clipboard
 * with fallback support for older browsers.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNotification } from "./useNotification";

/**
 * Hook for copying text to clipboard.
 *
 * @returns Object with copyToClipboard function
 */
export function useClipboard() {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useNotification();

  /**
   * Copies text to clipboard.
   *
   * @param text - Text to copy
   * @param successMessage - Custom success message (optional)
   * @param errorMessage - Custom error message (optional)
   */
  const copyToClipboard = useCallback(
    async (
      text: string,
      successMessage?: string,
      errorMessage?: string,
    ): Promise<void> => {
      if (!text) {
        return;
      }

      try {
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          notifySuccess(successMessage || t("common.copied"));
          return;
        }

        // Fallback for older browsers or insecure contexts
        if (typeof document === "undefined") {
          throw new Error(errorMessage || t("common.copyFailed"));
        }

        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!success) {
          throw new Error(errorMessage || t("common.copyFailed"));
        }
        notifySuccess(successMessage || t("common.copied"));
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : errorMessage || t("common.copyFailed");
        notifyError(errorMsg);
      }
    },
    [notifyError, notifySuccess, t],
  );

  return { copyToClipboard };
}
