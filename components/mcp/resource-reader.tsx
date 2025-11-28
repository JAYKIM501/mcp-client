'use client';

import { useState } from 'react';
import { Eye, X, Loader2 } from 'lucide-react';
import { ResultViewer } from './result-viewer';

interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface ResourceReaderProps {
  resource: Resource;
  serverId: string;
  onClose: () => void;
}

export function ResourceReader({ resource, serverId, onClose }: ResourceReaderProps) {
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRead = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/mcp/action/read-resource', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          uri: resource.uri,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to read resource');
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{resource.name || resource.uri}</h4>
          {resource.description && (
            <p className="text-sm text-muted-foreground mt-1">{resource.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 font-mono">{resource.uri}</p>
          {resource.mimeType && (
            <p className="text-xs text-muted-foreground">MIME: {resource.mimeType}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleRead}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Eye size={16} />
          )}
          읽기
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {result !== null && <ResultViewer result={result} title="리소스 내용" />}
    </div>
  );
}

