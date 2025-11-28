'use client';

import { useState } from 'react';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { ResultViewer } from './result-viewer';

interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

interface PromptExecutorProps {
  prompt: Prompt;
  serverId: string;
  onClose: () => void;
}

export function PromptExecutor({ prompt, serverId, onClose }: PromptExecutorProps) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const promptArgs = prompt.arguments || [];

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/mcp/action/get-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          name: prompt.name,
          arguments: args,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get prompt');
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-green-500/30 rounded-lg p-4 bg-green-500/5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{prompt.name}</h4>
          {prompt.description && (
            <p className="text-sm text-muted-foreground mt-1">{prompt.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X size={16} />
        </button>
      </div>

      {promptArgs.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium">인자</div>
          {promptArgs.map((arg) => (
            <div key={arg.name}>
              <label className="block text-sm mb-1">
                {arg.name}
                {arg.required && <span className="text-destructive ml-1">*</span>}
              </label>
              {arg.description && (
                <p className="text-xs text-muted-foreground mb-1">{arg.description}</p>
              )}
              <input
                type="text"
                value={args[arg.name] || ''}
                onChange={(e) => setArgs({ ...args, [arg.name]: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleExecute}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <MessageSquare size={16} />
          )}
          실행
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {result !== null && <ResultViewer result={result} title="프롬프트 결과" />}
    </div>
  );
}

