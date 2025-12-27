/**
 * Custom hook for managing chat messages and interactions.
 *
 * This hook provides state management for chat messages and handles
 * sending messages with streaming support.
 */

import {useState, useCallback, useRef, useEffect} from 'react';
import {ChatMessage} from '../types';
import {sendMessageStream} from '../api/tutor';
import {getRandomThinkingMessage} from '../utils/constants';

/**
 * Return type for useChat hook.
 */
export interface UseChatReturn {
  readonly messages: readonly ChatMessage[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly sendMessage: (message: string) => Promise<void>;
  readonly clearMessages: () => void;
  readonly setMessages: (messages: readonly ChatMessage[]) => void;
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
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const streamContentRef = useRef<string>('');

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId || !message.trim()) {
        return;
      }

      const userMsg = message.trim();
      setMessages((prev) => [...prev, {role: 'user', content: userMsg}]);
      setIsLoading(true);
      setError(null);
      streamContentRef.current = '';

      // Add thinking message
      setMessages((prev) => [
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
          sessionId,
          userMsg,
          // onToken: Update message content in real-time
          (token: string) => {
            streamContentRef.current += token;
            setMessages((prev) => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                return [
                  ...newMessages.slice(0, -1),
                  {
                    ...lastMessage,
                    content: streamContentRef.current,
                    isThinking: false,
                  },
                ];
              }
              return newMessages;
            });
            if (streamContentRef.current.length > 0 && isLoading) {
              setIsLoading(false);
            }
          },
          // onComplete: Stream finished
          () => {
            setIsLoading(false);
            if (onStateUpdate) {
              onStateUpdate();
            }
          },
          // onError: Handle errors
          (errorMessage: string) => {
            console.error('Failed to send message:', errorMessage);
            setError(errorMessage);
            setMessages((prev) => {
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
            setIsLoading(false);
          },
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        console.error('Failed to send message:', err);
        setMessages((prev) => {
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
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, onStateUpdate],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const setMessagesCallback = useCallback(
    (newMessages: readonly ChatMessage[]) => {
      setMessages(newMessages);
    },
    [],
  );

  // Clear messages when session changes
  useEffect(() => {
    if (!sessionId) {
      clearMessages();
    }
  }, [sessionId, clearMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    setMessages: setMessagesCallback,
  };
}




