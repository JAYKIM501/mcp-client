'use client';

import { useState, useEffect } from 'react';
import { ServerConfigForm } from '@/components/mcp/server-config-form';
import { ServerConfig } from '@/lib/mcp-manager';
import { Plus, Trash2, Power, PowerOff, Download, Upload, X, Edit2, ArrowLeft, Wrench, FolderOpen, FileText, Server, Inbox } from 'lucide-react';
import Link from 'next/link';

const STORAGE_KEY = 'mcp-servers';

export default function MCPPage() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [connectedServers, setConnectedServers] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>();
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);

  useEffect(() => {
    loadServers();
    checkStatus();
  }, []);

  const loadServers = () => {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        setServers(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
    }
  };

  const saveServers = (newServers: ServerConfig[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newServers));
    setServers(newServers);
  };

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/mcp/status');
      const data = await res.json();
      setConnectedServers(new Set(data.servers.map((s: any) => s.id)));
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  const handleSave = async (config: ServerConfig) => {
    const index = servers.findIndex((s) => s.id === config.id);
    const newServers = index >= 0
      ? servers.map((s) => (s.id === config.id ? config : s))
      : [...servers, config];
    
    saveServers(newServers);
    setShowForm(false);
    setEditingServer(undefined);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 서버를 삭제하시겠습니까?')) {
      const newServers = servers.filter((s) => s.id !== id);
      saveServers(newServers);
      if (connectedServers.has(id)) {
        handleDisconnect(id);
      }
    }
  };

  const handleConnect = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;

    try {
      const res = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      });

      if (res.ok) {
        await checkStatus();
        if (selectedServer === id) {
          loadCapabilities(id);
        }
      } else {
        const error = await res.json();
        alert(`연결 실패: ${error.error}`);
      }
    } catch (error: any) {
      alert(`연결 실패: ${error.message}`);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await fetch('/api/mcp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: id }),
      });
      await checkStatus();
      if (selectedServer === id) {
        setSelectedServer(null);
        setTools([]);
        setResources([]);
        setPrompts([]);
      }
    } catch (error: any) {
      alert(`연결 해제 실패: ${error.message}`);
    }
  };

  const loadCapabilities = async (id: string) => {
    try {
      const [toolsRes, resourcesRes, promptsRes] = await Promise.all([
        fetch(`/api/mcp/tools?serverId=${id}`),
        fetch(`/api/mcp/resources?serverId=${id}`),
        fetch(`/api/mcp/prompts?serverId=${id}`),
      ]);

      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        setTools(toolsData.tools || []);
      }
      if (resourcesRes.ok) {
        const resourcesData = await resourcesRes.json();
        setResources(resourcesData.resources || []);
      }
      if (promptsRes.ok) {
        const promptsData = await promptsRes.json();
        setPrompts(promptsData.prompts || []);
      }
    } catch (error) {
      console.error('Failed to load capabilities:', error);
    }
  };

  const handleSelectServer = (id: string) => {
    setSelectedServer(id);
    if (connectedServers.has(id)) {
      loadCapabilities(id);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(servers, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-servers-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          saveServers(imported);
          alert('서버 설정을 가져왔습니다.');
        } else {
          throw new Error('Invalid format');
        }
      } catch (error) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Server size={24} />
              <h1 className="text-2xl font-bold">MCP 서버 관리</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Model Context Protocol 서버를 등록하고 관리하세요
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              채팅으로 돌아가기
            </Link>
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              내보내기
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Upload size={16} />
              가져오기
            </button>
            <button
              onClick={() => {
                setEditingServer(undefined);
                setShowForm(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              서버 추가
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingServer ? '서버 수정' : '서버 추가'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingServer(undefined);
                }}
                className="p-1 hover:bg-muted rounded"
              >
                <X size={18} />
              </button>
            </div>
            <ServerConfigForm
              server={editingServer}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingServer(undefined);
              }}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 서버 목록 */}
          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Server size={18} />
              서버 목록
            </h2>
            <div className="space-y-2">
              {servers.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border border-border rounded-lg">
                  <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                  <p>등록된 서버가 없습니다</p>
                </div>
              ) : (
                servers.map((server) => (
                  <div
                    key={server.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedServer === server.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                    onClick={() => handleSelectServer(server.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{server.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {server.transport}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        {connectedServers.has(server.id) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnect(server.id);
                            }}
                            className="p-1 text-green-500 hover:bg-background rounded"
                            title="연결 해제"
                          >
                            <Power size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnect(server.id);
                            }}
                            className="p-1 text-muted-foreground hover:bg-background rounded"
                            title="연결"
                          >
                            <PowerOff size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingServer(server);
                            setShowForm(true);
                          }}
                          className="p-1 text-muted-foreground hover:bg-background rounded"
                          title="수정"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(server.id);
                          }}
                          className="p-1 text-destructive hover:bg-background rounded"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 서버 상세 정보 */}
          <div className="md:col-span-2">
            {selectedServer ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Wrench size={18} />
                    도구 (Tools)
                  </h2>
                  {connectedServers.has(selectedServer) ? (
                    <div className="space-y-2">
                      {tools.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                          <Wrench size={24} className="mx-auto mb-2 opacity-50" />
                          <p>사용 가능한 도구가 없습니다</p>
                        </div>
                      ) : (
                        tools.map((tool: any) => (
                          <div
                            key={tool.name}
                            className="p-3 border border-border rounded-lg"
                          >
                            <div className="font-medium">{tool.name}</div>
                            {tool.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {tool.description}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                      <PowerOff size={24} className="mx-auto mb-2 opacity-50" />
                      <p>서버에 연결하세요</p>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FolderOpen size={18} />
                    리소스 (Resources)
                  </h2>
                  {connectedServers.has(selectedServer) ? (
                    <div className="space-y-2">
                      {resources.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                          <FolderOpen size={24} className="mx-auto mb-2 opacity-50" />
                          <p>사용 가능한 리소스가 없습니다</p>
                        </div>
                      ) : (
                        resources.map((resource: any) => (
                          <div
                            key={resource.uri}
                            className="p-3 border border-border rounded-lg"
                          >
                            <div className="font-medium">{resource.name || resource.uri}</div>
                            {resource.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {resource.description}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {resource.uri}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                      <PowerOff size={24} className="mx-auto mb-2 opacity-50" />
                      <p>서버에 연결하세요</p>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText size={18} />
                    프롬프트 (Prompts)
                  </h2>
                  {connectedServers.has(selectedServer) ? (
                    <div className="space-y-2">
                      {prompts.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                          <FileText size={24} className="mx-auto mb-2 opacity-50" />
                          <p>사용 가능한 프롬프트가 없습니다</p>
                        </div>
                      ) : (
                        prompts.map((prompt: any) => (
                          <div
                            key={prompt.name}
                            className="p-3 border border-border rounded-lg"
                          >
                            <div className="font-medium">{prompt.name}</div>
                            {prompt.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {prompt.description}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                      <PowerOff size={24} className="mx-auto mb-2 opacity-50" />
                      <p>서버에 연결하세요</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
                <Server size={32} className="mx-auto mb-2 opacity-50" />
                <p>서버를 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

