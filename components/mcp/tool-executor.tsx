'use client';

import { useState } from 'react';
import { Play, X, Loader2 } from 'lucide-react';
import { ResultViewer } from './result-viewer';

interface ToolSchema {
  type: string;
  properties?: Record<string, {
    type: string;
    description?: string;
  }>;
  required?: string[];
}

interface Tool {
  name: string;
  description?: string;
  inputSchema?: ToolSchema;
}

interface ToolExecutorProps {
  tool: Tool;
  serverId: string;
  onClose: () => void;
}

export function ToolExecutor({ tool, serverId, onClose }: ToolExecutorProps) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // 타입 변환 처리
      const parsedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        const propType = properties[key]?.type;
        if (propType === 'number' || propType === 'integer') {
          parsedArgs[key] = Number(value);
        } else if (propType === 'boolean') {
          parsedArgs[key] = value === 'true';
        } else if (propType === 'object' || propType === 'array') {
          try {
            parsedArgs[key] = JSON.parse(value);
          } catch {
            parsedArgs[key] = value;
          }
        } else {
          parsedArgs[key] = value;
        }
      }

      const res = await fetch('/api/mcp/action/call-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          toolName: tool.name,
          arguments: parsedArgs,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute tool');
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium">{tool.name}</h4>
          {tool.description && (
            <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded"
        >
          <X size={16} />
        </button>
      </div>

      {Object.keys(properties).length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium">매개변수</div>
          {Object.entries(properties).map(([key, prop]) => (
            <div key={key}>
              <label className="block text-sm mb-1">
                {key}
                {required.includes(key) && <span className="text-destructive ml-1">*</span>}
                <span className="text-muted-foreground ml-2 text-xs">({prop.type})</span>
              </label>
              {prop.description && (
                <p className="text-xs text-muted-foreground mb-1">{prop.description}</p>
              )}
              <input
                type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                value={args[key] || ''}
                onChange={(e) => setArgs({ ...args, [key]: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={prop.type === 'object' || prop.type === 'array' ? 'JSON 형식으로 입력' : ''}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleExecute}
          disabled={isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          실행
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {result !== null && <ResultViewer result={result} />}
    </div>
  );
}

