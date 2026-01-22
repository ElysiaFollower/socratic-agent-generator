/**
 * Application-wide constants.
 *
 * This module contains constants used throughout the application.
 */

import i18n from '../i18n';

/**
 * Gets a random thinking message based on current language.
 *
 * @returns A random thinking message string
 */
export function getRandomThinkingMessage(): string {
  const messages = i18n.t('chat.thinkingMessages', { returnObjects: true }) as string[];
  return messages[Math.floor(Math.random() * messages.length)];
}
