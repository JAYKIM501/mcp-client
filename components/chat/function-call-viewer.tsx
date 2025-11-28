'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Zap, Server, Image as ImageIcon, ZoomIn, X, Download, ExternalLink } from 'lucide-react';
import { FunctionCall, FunctionResult } from '@/lib/storage';
import { CodeBlock } from '@/components/ui/code-block';
import { ImageViewer } from '@/components/ui/image-viewer';

// 결과에서 이미지 추출
function extractImagesFromResult(response: any): { images: string[]; otherContent: any } {
  const images: string[] = [];
  let otherContent: any = response;

  if (!response) return { images, otherContent };

  // MCP 응답 형식: { content: [{ type: 'image', data: '...', mimeType: '...' }] }
  if (response.content && Array.isArray(response.content)) {
    const nonImageContent: any[] = [];
    
    for (const item of response.content) {
      if (item.type === 'image' && item.data) {
        // URL 형식인지 확인
        if (item.data.startsWith('http') || item.data.startsWith('/')) {
          images.push(item.data);
        } else if (item.data.startsWith('data:')) {
          // 이미 Data URL 형식인 경우
          images.push(item.data);
        } else {
          // Base64 Raw 데이터인 경우
          const mimeType = item.mimeType || 'image/png';
          images.push(`data:${mimeType};base64,${item.data}`);
        }
      } else if (item.type === 'resource' && item.resource?.blob) {
        // Resource blob 형식
        const mimeType = item.resource.mimeType || 'image/png';
        images.push(`data:${mimeType};base64,${item.resource.blob}`);
      } else if (item.type === 'text' && item.text) {
        // URL 형식 이미지 감지
        const urlMatch = item.text.match(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)/gi);
        if (urlMatch) {
          images.push(...urlMatch);
        }
        nonImageContent.push(item);
      } else {
        nonImageContent.push(item);
      }
    }
    
    if (nonImageContent.length > 0) {
      otherContent = { ...response, content: nonImageContent };
    } else if (images.length > 0) {
      otherContent = null;
    }
  }

  // 직접 URL 형식
  if (typeof response === 'string') {
    const urlMatch = response.match(/https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)/gi);
    if (urlMatch) {
      images.push(...urlMatch);
      otherContent = null;
    }
  }

  // imageUrl 필드
  if (response.imageUrl) {
    images.push(response.imageUrl);
  }
  if (response.image_url) {
    images.push(response.image_url);
  }
  if (response.url && /\.(png|jpg|jpeg|gif|webp|svg)/i.test(response.url)) {
    images.push(response.url);
  }

  return { images, otherContent };
}

// 결과 이미지 컴포넌트
function ResultImage({ src, alt }: { src: string; alt: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <>
      <div className="relative inline-block group cursor-pointer">
        {isLoading && (
          <div className="w-48 h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
            <span className="text-xs text-muted-foreground">로딩 중...</span>
          </div>
        )}
        {error ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            <X size={16} />
            이미지를 불러올 수 없습니다
          </div>
        ) : (
          <>
            <img
              src={src}
              alt={alt}
              className={`max-w-full max-h-48 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-transform hover:scale-[1.02] ${isLoading ? 'hidden' : 'block'}`}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError(true);
              }}
              onClick={() => setIsOpen(true)}
            />
            {!isLoading && !error && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                onClick={() => setIsOpen(true)}
              >
                <ZoomIn size={20} className="text-white" />
              </div>
            )}
          </>
        )}
      </div>
      {isOpen && (
        <ImageViewer src={src} alt={alt} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

interface FunctionCallViewerProps {
  functionCalls?: FunctionCall[];
  functionResults?: FunctionResult[];
}

export function FunctionCallViewer({ functionCalls, functionResults }: FunctionCallViewerProps) {
  // 기본적으로 모두 접힘 상태
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  // 처음 로드 시 이미지가 포함된 결과만 펼침
  useEffect(() => {
    if (!functionCalls || functionCalls.length === 0 || !functionResults) {
      return;
    }

    const keysToExpand = new Set<string>();
    
    functionCalls.forEach((_, index) => {
      const result = functionResults[index];
      if (result && !result.error) {
        // 결과에서 이미지 추출
        const { images } = extractImagesFromResult(result.response);
        // 이미지가 있으면 펼침
        if (images && images.length > 0) {
          keysToExpand.add(`func-${index}`);
        }
      }
    });
    
    // 상태가 변경된 경우에만 업데이트 (무한 루프 방지)
    setExpanded((prev) => {
      const prevStr = Array.from(prev).sort().join(',');
      const newStr = Array.from(keysToExpand).sort().join(',');
      if (prevStr !== newStr) {
        return keysToExpand;
      }
      return prev;
    });
  }, [functionCalls, functionResults]);

  if (!functionCalls || functionCalls.length === 0) {
    return null;
  }

  const toggleExpanded = (index: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // 함수 이름에서 도구 이름 추출 (mcpToTool 형식 지원)
  const parseToolName = (name: string) => {
    // mcpToTool은 원래 도구 이름을 그대로 사용
    return name;
  };

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Zap size={12} className="text-yellow-500" />
        <span className="font-medium">MCP 도구 호출</span>
      </div>
      {functionCalls.map((funcCall, index) => {
        const key = `func-${index}`;
        const isExpanded = expanded.has(key);
        const result = functionResults?.[index];
        const hasError = result?.error;
        const isLoading = !result && !hasError;

        // 함수 이름 추출
        const toolName = parseToolName(funcCall.name);

        return (
          <div
            key={key}
            className={`border rounded-lg overflow-hidden transition-all ${
              hasError 
                ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20' 
                : result 
                  ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                  : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20'
            }`}
          >
            <button
              onClick={() => toggleExpanded(key)}
              className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-yellow-500 flex-shrink-0" />
                ) : hasError ? (
                  <XCircle size={16} className="text-red-500 flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <Server size={12} className="text-violet-500 flex-shrink-0" />
                  <span className="text-sm font-semibold truncate text-foreground" title={toolName}>
                    {toolName}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isLoading 
                    ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                    : hasError 
                      ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                      : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                }`}>
                  {isLoading ? '실행 중...' : hasError ? '오류' : '완료'}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
              )}
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 pt-2 space-y-3 border-t border-inherit bg-white/50 dark:bg-gray-900/50">
                {/* 함수 결과 */}
                {result && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                      {hasError ? (
                        <>
                          <XCircle size={12} className="text-red-500" />
                          오류
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} className="text-green-500" />
                          결과
                        </>
                      )}
                    </div>
                    {hasError ? (
                      <div className="text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                        {result.error}
                      </div>
                    ) : (
                      <>
                        {/* 이미지 결과 표시 */}
                        {(() => {
                          const { images, otherContent } = extractImagesFromResult(result.response);
                          return (
                            <>
                              {images.length > 0 && (
                                <div className="mb-2">
                                  <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <ImageIcon size={12} />
                                    생성된 이미지
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {images.map((img, idx) => (
                                      <ResultImage key={idx} src={img} alt={`결과 이미지 ${idx + 1}`} />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {otherContent && (
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 overflow-x-auto max-h-48 overflow-y-auto">
                                  <CodeBlock
                                    language="json"
                                    value={JSON.stringify(otherContent, null, 2)}
                                  />
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 py-3">
                    <Loader2 size={14} className="animate-spin" />
                    도구 실행 중...
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

