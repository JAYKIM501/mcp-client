'use client';

import React, { memo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { CodeBlock } from '@/components/ui/code-block';
import { Copy, Check } from 'lucide-react';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

const MessageBubble = memo(({ role, content }: MessageBubbleProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div
      className={`flex ${
        role === 'user' ? 'justify-end' : 'justify-start'
      } group`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-lg px-4 py-3 relative shadow-sm ${
          role === 'user'
            ? 'bg-blue-600 text-white border border-blue-700'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
        }`}
      >
        {/* 복사 버튼 */}
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 p-1.5 rounded transition-opacity ${
            role === 'user'
              ? 'hover:bg-blue-700 text-white'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
          } opacity-0 group-hover:opacity-100`}
          title="복사"
        >
          {isCopied ? (
            <Check size={14} className="text-green-500" />
          ) : (
            <Copy size={14} />
          )}
        </button>

        {role === 'user' ? (
          <div className="whitespace-pre-wrap break-words pr-8">{content}</div>
        ) : (
          <div className="pr-8">
            <Markdown
              options={{
                overrides: {
                  code: {
                    component: ({ className, children, ...props }: any) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match && !String(children).includes('\n');
                      
                      if (!isInline && match) {
                        return (
                          <CodeBlock
                            language={match[1]}
                            value={String(children).replace(/\n$/, '')}
                          />
                        );
                      }

                      return (
                        <code
                          className={`${className} bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm`}
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                  },
                  a: {
                    component: ({ children, ...props }: any) => (
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline break-all"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                  },
                  table: {
                    component: ({ children, ...props }: any) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border border-gray-300 dark:border-gray-700" {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                  },
                  th: {
                    component: ({ children, ...props }: any) => (
                      <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-300 dark:border-gray-700" {...props}>
                        {children}
                      </th>
                    ),
                  },
                  td: {
                    component: ({ children, ...props }: any) => (
                      <td className="px-3 py-2 whitespace-nowrap text-sm border-r border-gray-300 dark:border-gray-700" {...props}>
                        {children}
                      </td>
                    ),
                  },
                  ul: {
                    component: ({ children, ...props }: any) => (
                      <ul className="list-disc list-inside my-2 space-y-1" {...props}>
                        {children}
                      </ul>
                    ),
                  },
                  ol: {
                    component: ({ children, ...props }: any) => (
                      <ol className="list-decimal list-inside my-2 space-y-1" {...props}>
                        {children}
                      </ol>
                    ),
                  },
                  p: {
                    component: ({ children, ...props }: any) => (
                      <p className="my-2 leading-relaxed last:mb-0" {...props}>
                        {children}
                      </p>
                    ),
                  },
                },
              }}
              className="prose dark:prose-invert max-w-none text-sm sm:text-base break-words"
            >
              {content}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export { MessageBubble };
