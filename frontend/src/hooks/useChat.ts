/**
 * Custom hook for managing chat messages and interactions.
 *
 * This hook provides state management for chat messages and handles
 * sending messages with streaming support.
 */

import {useState, useCallback, useRef} from 'react';
import {ChatMessage} from '../types';
import {sendMessageStream} from '../api/tutor';
import {getRandomThinkingMessage} from '../utils/constants';

/**
 * Return type for useChat hook.
 */
export interface UseChatReturn {
  readonly messages: readonly ChatMessage[];
  readonly messagesBySession: Readonly<Record<string, readonly ChatMessage[]>>;
  readonly isLoading: boolean;
  readonly isLoadingBySession: Readonly<Record<string, boolean>>;
  readonly error: string | null;
  readonly errorBySession: Readonly<Record<string, string | null>>;
  readonly sendMessage: (message: string) => Promise<void>;
  readonly clearMessages: (targetSessionId?: string | null) => void;
  readonly setMessages: (
    messages: readonly ChatMessage[],
    targetSessionId?: string | null,
  ) => void;
  readonly setMessagesIfEmpty: (
    messages: readonly ChatMessage[],
    targetSessionId?: string | null,
  ) => void;
  readonly removeSession: (targetSessionId: string) => void;
}

/**
 * Custom hook for managing chat messages.
 *
 * @param sessionId - The current session ID (null if no session)
 * @param onStateUpdate - Callback invoked when session state should be updated
 * @returns Object containing messages, loading state, error, and message functions
 */
export function useChat(
  sessionId: string | null,
  onStateUpdate?: () => void,
): UseChatReturn {
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, readonly ChatMessage[]>
  >({});
  const [isLoadingBySession, setIsLoadingBySession] = useState<
    Record<string, boolean>
  >({});
  const [errorBySession, setErrorBySession] = useState<
    Record<string, string | null>
  >({});
  // Maintain per-session buffers so streaming tokens never bleed across sessions.
  const streamContentRef = useRef<Record<string, string>>({});

  const updateSessionMessages = useCallback(
    (
      targetSessionId: string,
      updater: (messages: readonly ChatMessage[]) => readonly ChatMessage[],
    ) => {
      setMessagesBySession((prev) => {
        const prevMessages = prev[targetSessionId] || [];
        const nextMessages = updater(prevMessages);
        if (nextMessages === prevMessages) {
          return prev;
        }
        return {
          ...prev,
          [targetSessionId]: nextMessages,
        };
      });
    },
    [],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId || !message.trim()) {
        return;
      }

      const targetSessionId = sessionId;
      const userMsg = message.trim();
      updateSessionMessages(targetSessionId, (prev) => [
        ...prev,
        {role: 'user', content: userMsg},
      ]);
      setIsLoadingBySession((prev) => ({
        ...prev,
        [targetSessionId]: true,
      }));
      setErrorBySession((prev) => ({
        ...prev,
        [targetSessionId]: null,
      }));
      streamContentRef.current[targetSessionId] = '';

      // Add thinking message
      updateSessionMessages(targetSessionId, (prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          isThinking: true,
          thinkingMessage: getRandomThinkingMessage(),
        },
      ]);

      try {
        await sendMessageStream(
          targetSessionId,
          userMsg,
          // onToken: Update message content in real-time
          (token: string) => {
            streamContentRef.current[targetSessionId] =
              (streamContentRef.current[targetSessionId] || '') + token;
            updateSessionMessages(targetSessionId, (prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                return [
                  ...newMessages.slice(0, -1),
                  {
                    ...lastMessage,
                    content: streamContentRef.current[targetSessionId] || '',
                    isThinking: false,
                  },
                ];
              }
              return newMessages;
            });
            if ((streamContentRef.current[targetSessionId] || '').length > 0) {
              setIsLoadingBySession((prev) => ({
                ...prev,
                [targetSessionId]: false,
              }));
            }
          },
          // onComplete: Stream finished
          () => {
            setIsLoadingBySession((prev) => ({
              ...prev,
              [targetSessionId]: false,
            }));
            if (onStateUpdate) {
              onStateUpdate();
            }
          },
          // onError: Handle errors
          (errorMessage: string) => {
            console.error('Failed to send message:', errorMessage);
            setErrorBySession((prev) => ({
              ...prev,
              [targetSessionId]: errorMessage,
            }));
            updateSessionMessages(targetSessionId, (prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                return [
                  ...newMessages.slice(0, -1),
                  {
                    ...lastMessage,
                    content: '抱歉，我遇到了一些问题。请稍后再试。',
                    isThinking: false,
                  },
                ];
              }
              return newMessages;
            });
            setIsLoadingBySession((prev) => ({
              ...prev,
              [targetSessionId]: false,
            }));
          },
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send message';
        setErrorBySession((prev) => ({
          ...prev,
          [targetSessionId]: errorMessage,
        }));
        console.error('Failed to send message:', err);
        updateSessionMessages(targetSessionId, (prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            return [
              ...newMessages.slice(0, -1),
              {
                ...lastMessage,
                content: '抱歉，我遇到了一些问题。请稍后再试。',
                isThinking: false,
              },
            ];
          }
          return newMessages;
        });
        setIsLoadingBySession((prev) => ({
          ...prev,
          [targetSessionId]: false,
        }));
      }
    },
    [sessionId, onStateUpdate, updateSessionMessages],
  );

  const clearMessages = useCallback((targetSessionId?: string | null) => {
    if (!targetSessionId) {
      return;
    }
    setMessagesBySession((prev) => ({
      ...prev,
      [targetSessionId]: [],
    }));
    setIsLoadingBySession((prev) => ({
      ...prev,
      [targetSessionId]: false,
    }));
    setErrorBySession((prev) => ({
      ...prev,
      [targetSessionId]: null,
    }));
    delete streamContentRef.current[targetSessionId];
  }, []);

  const setMessagesCallback = useCallback(
    (newMessages: readonly ChatMessage[], targetSessionId = sessionId) => {
      if (!targetSessionId) {
        return;
      }
      setMessagesBySession((prev) => ({
        ...prev,
        [targetSessionId]: Array.from(newMessages),
      }));
    },
    [sessionId],
  );

  const setMessagesIfEmpty = useCallback(
    (newMessages: readonly ChatMessage[], targetSessionId = sessionId) => {
      if (!targetSessionId) {
        return;
      }
      setMessagesBySession((prev) => {
        const existing = prev[targetSessionId];
        // Avoid overwriting streaming output already captured for this session.
        if (existing && existing.length > 0) {
          return prev;
        }
        return {
          ...prev,
          [targetSessionId]: Array.from(newMessages),
        };
      });
    },
    [sessionId],
  );

  const removeSession = useCallback((targetSessionId: string) => {
    setMessagesBySession((prev) => {
      if (!(targetSessionId in prev)) {
        return prev;
      }
      const next = {...prev};
      delete next[targetSessionId];
      return next;
    });
    setIsLoadingBySession((prev) => {
      if (!(targetSessionId in prev)) {
        return prev;
      }
      const next = {...prev};
      delete next[targetSessionId];
      return next;
    });
    setErrorBySession((prev) => {
      if (!(targetSessionId in prev)) {
        return prev;
      }
      const next = {...prev};
      delete next[targetSessionId];
      return next;
    });
    delete streamContentRef.current[targetSessionId];
  }, []);

  const messages = sessionId ? messagesBySession[sessionId] || [] : [];
  const isLoading = sessionId ? Boolean(isLoadingBySession[sessionId]) : false;
  const error = sessionId ? errorBySession[sessionId] || null : null;

  return {
    messages,
    messagesBySession,
    isLoading,
    isLoadingBySession,
    error,
    errorBySession,
    sendMessage,
    clearMessages,
    setMessages: setMessagesCallback,
    setMessagesIfEmpty,
    removeSession,
  };
}


