'use client';

import { useState } from 'react';
import { ServerConfig } from '@/lib/mcp-manager';
import { X, Save, Server, Globe, Terminal, Key } from 'lucide-react';

interface ServerConfigFormProps {
  server?: ServerConfig;
  onSave: (config: ServerConfig) => void;
  onCancel: () => void;
}

export function ServerConfigForm({ server, onSave, onCancel }: ServerConfigFormProps) {
  const [name, setName] = useState(server?.name || '');
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'streamable-http'>(
    server?.transport || 'stdio'
  );
  const [command, setCommand] = useState(server?.command || '');
  const [args, setArgs] = useState(server?.args?.join(' ') || '');
  const [url, setUrl] = useState(server?.url || '');
  const [authToken, setAuthToken] = useState(server?.authToken || '');
  const [authHeader, setAuthHeader] = useState(server?.authHeader || 'Authorization');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const config: ServerConfig = {
      id: server?.id || Date.now().toString(),
      name: name.trim(),
      transport,
      ...(transport === 'stdio' && {
        command: command.trim(),
        args: args.trim() ? args.trim().split(/\s+/) : [],
      }),
      ...((transport === 'sse' || transport === 'streamable-http') && {
        url: url.trim(),
        ...(authToken.trim() && {
          authToken: authToken.trim(),
          authHeader: authHeader.trim() || 'Authorization',
        }),
      }),
    };

    onSave(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1 flex items-center gap-2">
          <Server size={14} />
          서버 이름
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="예: 파일 시스템 서버"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1 flex items-center gap-2">
          <Globe size={14} />
          전송 방식
        </label>
        <select
          value={transport}
          onChange={(e) => setTransport(e.target.value as 'stdio' | 'sse' | 'streamable-http')}
          className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="stdio">STDIO</option>
          <option value="sse">SSE</option>
          <option value="streamable-http">Streamable HTTP</option>
        </select>
      </div>

      {transport === 'stdio' && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <Terminal size={14} />
              명령어
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              required
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="예: node"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">인자 (공백으로 구분)</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="예: server.js --port 3000"
            />
          </div>
        </>
      )}

      {(transport === 'sse' || transport === 'streamable-http') && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="예: http://localhost:3000/mcp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              <Key size={14} />
              인증 토큰 (선택사항)
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Bearer token 또는 API key"
            />
            <p className="text-xs text-muted-foreground mt-1">
              인증이 필요한 서버의 경우 토큰을 입력하세요
            </p>
          </div>
          {authToken && (
            <div>
              <label className="block text-sm font-medium mb-1">인증 헤더 이름</label>
              <input
                type="text"
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Authorization"
              />
              <p className="text-xs text-muted-foreground mt-1">
                기본값: Authorization (Bearer token의 경우 &quot;Bearer {'{token}'}&quot; 형식으로 자동 추가)
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Save size={16} />
          저장
        </button>
      </div>
    </form>
  );
}

