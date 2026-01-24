/**
 * Custom hook for managing chat messages and interactions.
 *
 * This hook provides state management for chat messages and handles
 * sending messages with streaming support.
 */

import {useState, useCallback, useRef} from 'react';
import {ChatMessage, StepCompletion} from '../types';
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
  readonly sendMessage: (
    message: string,
    options?: {
      readonly appendUserMessage?: boolean;
      readonly provider?: string;
      readonly model?: string;
    },
  ) => Promise<void>;
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
  onStepCompletion?: (
    completion: StepCompletion,
    targetSessionId: string,
  ) => void,
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

  const applyMessageIds = useCallback(
    (targetSessionId: string, assistantMessageId: number) => {
      if (!assistantMessageId || assistantMessageId < 1) {
        return;
      }
      updateSessionMessages(targetSessionId, (prev) => {
        const newMessages = [...prev];
        let assistantIndex = -1;
        for (let i = newMessages.length - 1; i >= 0; i -= 1) {
          if (newMessages[i]?.role === 'assistant') {
            assistantIndex = i;
            break;
          }
        }
        if (assistantIndex < 0) {
          return prev;
        }
        const assistantMessage = newMessages[assistantIndex];
        if (!assistantMessage.messageId) {
          newMessages[assistantIndex] = {
            ...assistantMessage,
            messageId: assistantMessageId,
          };
        }
        for (let i = assistantIndex - 1; i >= 0; i -= 1) {
          if (newMessages[i]?.role === 'user') {
            if (!newMessages[i].messageId) {
              newMessages[i] = {
                ...newMessages[i],
                messageId: assistantMessageId - 1,
              };
            }
            break;
          }
        }
        return newMessages;
      });
    },
    [updateSessionMessages],
  );

  const sendMessage = useCallback(
    async (
      message: string,
      options?: {
        readonly appendUserMessage?: boolean;
        readonly provider?: string;
        readonly model?: string;
      },
    ) => {
      if (!sessionId || !message.trim()) {
        return;
      }

      const targetSessionId = sessionId;
      const userMsg = message.trim();
      const shouldAppendUser = options?.appendUserMessage !== false;
      if (shouldAppendUser) {
        updateSessionMessages(targetSessionId, (prev) => [
          ...prev,
          {role: 'user', content: userMsg},
        ]);
      }
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
          { provider: options?.provider, model: options?.model },
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
          },
          // onComplete: Stream finished
          (response) => {
            setIsLoadingBySession((prev) => ({
              ...prev,
              [targetSessionId]: false,
            }));
            if (response.message_id) {
              applyMessageIds(targetSessionId, response.message_id);
            }
            if (response.step_completion && onStepCompletion) {
              onStepCompletion(response.step_completion, targetSessionId);
            }
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
    [
      sessionId,
      onStateUpdate,
      onStepCompletion,
      applyMessageIds,
      updateSessionMessages,
    ],
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
