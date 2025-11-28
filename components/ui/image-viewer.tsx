'use client';

import { X, Download, ExternalLink } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="relative max-w-[95vw] max-h-[90vh] w-full flex flex-col items-center justify-center">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title="닫기"
        >
          <X size={24} />
        </button>
        
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        
        <div className="mt-4 flex gap-4" onClick={(e) => e.stopPropagation()}>
          <a
            href={src}
            download={`image-${Date.now()}.png`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm backdrop-blur-sm"
            title="다운로드"
          >
            <Download size={18} />
            <span>다운로드</span>
          </a>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm backdrop-blur-sm"
            title="새 탭에서 열기"
          >
            <ExternalLink size={18} />
            <span>원본 보기</span>
          </a>
        </div>
      </div>
    </div>
  );
}

