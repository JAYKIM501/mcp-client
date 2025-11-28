'use client';

import React, { memo, useState, Children } from 'react';
import Markdown from 'markdown-to-jsx';
import { CodeBlock } from '@/components/ui/code-block';
import { Copy, Check, ZoomIn, X } from 'lucide-react';
import { FunctionCallViewer } from './function-call-viewer';
import { FunctionCall, FunctionResult, MessageImage } from '@/lib/storage';
import { ImageViewer } from '@/components/ui/image-viewer';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  images?: MessageImage[];
  functionCalls?: FunctionCall[];
  functionResults?: FunctionResult[];
}

// 채팅 이미지 컴포넌트 (인라인 블록으로 변경하여 p 태그 안에 들어갈 수 있도록)
function ChatImage({ src, alt, inline = false }: { src: string; alt: string; inline?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const ImageContent = () => (
    <>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
          <span className="text-xs text-muted-foreground">로딩 중...</span>
        </span>
      )}
      {error ? (
        <span className="inline-flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          <X size={16} />
          이미지를 불러올 수 없습니다
        </span>
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            className={`max-w-full max-h-80 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-transform hover:scale-[1.02] ${isLoading ? 'invisible' : 'visible'}`}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError(true);
            }}
            onClick={() => setIsOpen(true)}
          />
          <span 
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none"
            onClick={() => setIsOpen(true)}
          >
            <ZoomIn size={24} className="text-white" />
          </span>
        </>
      )}
    </>
  );

  if (inline) {
    // 인라인 모드: span 사용 (p 태그 안에 들어갈 수 있음)
    return (
      <>
        <span className="relative inline-block my-2 group cursor-pointer">
          <ImageContent />
        </span>
        {isOpen && (
          <ImageViewer src={src} alt={alt} onClose={() => setIsOpen(false)} />
        )}
      </>
    );
  }

  // 블록 모드: div 사용
  return (
    <>
      <div className="relative inline-block my-2 group cursor-pointer">
        <ImageContent />
      </div>
      {isOpen && (
        <ImageViewer src={src} alt={alt} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

const MessageBubble = memo(({ role, content, images, functionCalls, functionResults }: MessageBubbleProps) => {
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
          <div className="whitespace-pre-wrap break-words pr-8">
            {content}
            {/* 사용자 메시지의 이미지 표시 */}
            {images && images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <ChatImage key={idx} src={img.url} alt={img.alt || `이미지 ${idx + 1}`} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="pr-8">
            {/* Function Calling 시각화 */}
            {(functionCalls && functionCalls.length > 0) && (
              <FunctionCallViewer
                functionCalls={functionCalls}
                functionResults={functionResults}
              />
            )}
            {/* AI 응답의 이미지 (별도 배열) */}
            {images && images.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <ChatImage key={idx} src={img.url} alt={img.alt || `이미지 ${idx + 1}`} />
                ))}
              </div>
            )}
            <Markdown
              options={{
                overrides: {
                  code: {
                    component: ({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: unknown }) => {
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
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
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
                  img: {
                    component: ({ src, alt, ...props }: { src?: string; alt?: string; [key: string]: unknown }) => {
                      if (!src) return null;
                      return <ChatImage src={src} alt={alt || '이미지'} inline={true} />;
                    },
                  },
                  p: {
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
                      // 이미지가 포함된 경우 div로 렌더링 (p 태그 안에 div가 들어갈 수 없음)
                      const hasImage = Children.toArray(children).some(
                        (child: unknown) => {
                          if (typeof child === 'object' && child !== null) {
                            const childObj = child as { type?: { name?: string }; props?: { src?: string; children?: React.ReactNode } };
                            return childObj.type?.name === 'ChatImage' || 
                                   childObj.props?.src || 
                                   (childObj.props?.children && Children.toArray(childObj.props.children as React.ReactNode).some((c: unknown) => {
                                     const cObj = c as { props?: { src?: string } };
                                     return cObj?.props?.src;
                                   }));
                          }
                          return false;
                        }
                      );
                      const Tag = hasImage ? 'div' : 'p';
                      return (
                        <Tag className="my-2 leading-relaxed last:mb-0" {...props}>
                          {children}
                        </Tag>
                      );
                    },
                  },
                  table: {
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700 border border-gray-300 dark:border-gray-700" {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                  },
                  th: {
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
                      <th className="bg-gray-100 dark:bg-gray-800 px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-300 dark:border-gray-700" {...props}>
                        {children}
                      </th>
                    ),
                  },
                  td: {
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
                      <td className="px-3 py-2 whitespace-nowrap text-sm border-r border-gray-300 dark:border-gray-700" {...props}>
                        {children}
                      </td>
                    ),
                  },
                  ul: {
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
                      <ul className="list-disc list-inside my-2 space-y-1" {...props}>
                        {children}
                      </ul>
                    ),
                  },
                  ol: {
                    component: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
                      <ol className="list-decimal list-inside my-2 space-y-1" {...props}>
                        {children}
                      </ol>
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
