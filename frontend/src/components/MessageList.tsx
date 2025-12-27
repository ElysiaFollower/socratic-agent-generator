/**
 * MessageList component for displaying chat messages.
 *
 * This component renders the list of chat messages with proper
 * styling and formatting.
 */

import React from 'react';
import {ChatMessage} from '../types';

/**
 * Props for MessageList component.
 */
export interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  readonly onScrollToBottom?: () => void;
}

/**
 * MessageList component for displaying chat messages.
 *
 * @param props - Component props
 * @returns React component
 */
export function MessageList(props: MessageListProps): JSX.Element {
  const {messages, onScrollToBottom} = props;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    if (onScrollToBottom) {
      onScrollToBottom();
    }
  }, [messages, onScrollToBottom]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <h3 className="text-lg mb-2">👋 欢迎来到苏格拉底式学习</h3>
          <p>选择一个会话开始你的学习之旅，或者创建一个新会话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`flex max-w-4xl ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            } items-start gap-3`}
          >
            {/* Avatar */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                message.role === 'user'
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {message.role === 'user' ? '😂' : '🤖'}
            </div>

            {/* Message Content */}
            <div
              className={`flex flex-col ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`px-4 py-3 rounded-2xl max-w-2xl ${
                  message.role === 'user'
                    ? 'bg-blue-400 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                {message.role === 'assistant' && message.isThinking ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm text-gray-600">
                      {message.thinkingMessage || '导师正在思考...'}
                    </span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                )}
              </div>
              {message.role === 'assistant' && !message.isThinking && (
                <div className="text-xs text-gray-500 mt-1 ml-1">
                  苏格拉底式导师
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}




