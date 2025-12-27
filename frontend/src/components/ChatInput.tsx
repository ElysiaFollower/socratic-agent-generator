/**
 * ChatInput component for message input.
 *
 * This component provides a textarea for user input with send functionality.
 */

import React from 'react';

/**
 * Props for ChatInput component.
 */
export interface ChatInputProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
}

/**
 * ChatInput component for message input.
 *
 * @param props - Component props
 * @returns React component
 */
export function ChatInput(props: ChatInputProps): JSX.Element {
  const {value, disabled, placeholder, onChange, onSend} = props;

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex gap-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        rows={2}
        className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={
          placeholder ||
          '输入你的想法或问题... (Enter发送，Shift+Enter换行)'
        }
        disabled={disabled}
      />
      <button
        onClick={onSend}
        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        disabled={disabled || !value.trim()}
      >
        发送
      </button>
    </div>
  );
}




