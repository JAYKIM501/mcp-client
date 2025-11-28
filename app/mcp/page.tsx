'use client';

import { useState, useEffect } from 'react';
import { ServerConfigForm } from '@/components/mcp/server-config-form';
import { ToolExecutor } from '@/components/mcp/tool-executor';
import { ResourceReader } from '@/components/mcp/resource-reader';
import { PromptExecutor } from '@/components/mcp/prompt-executor';
import { ServerConfig } from '@/lib/mcp-manager';
import { useMCP, getStoredServers, saveStoredServers } from '@/lib/mcp-context';
import { migrateLocalStorageToSupabase } from '@/lib/mcp-migration';
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  Download,
  Upload,
  X,
  Edit2,
  ArrowLeft,
  Wrench,
  FolderOpen,
  FileText,
  Server,
  Inbox,
  Play,
  Eye,
  MessageSquare,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Link from 'next/link';

export default function MCPPage() {
  const { connectedServers, isLoading: mcpLoading, connect, disconnect, refresh, isConnected } = useMCP();
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [serverEnabledStates, setServerEnabledStates] = useState<Map<string, boolean>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | undefined>();
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);

  // 실행 중인 항목 상태
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [readingResource, setReadingResource] = useState<string | null>(null);
  const [executingPrompt, setExecutingPrompt] = useState<string | null>(null);

  // 연결 중인 서버 ID
  const [connectingServer, setConnectingServer] = useState<string | null>(null);
  const [loadingServers, setLoadingServers] = useState(true);

  // 서버 목록 로드 및 마이그레이션
  useEffect(() => {
    const loadServers = async () => {
      try {
        setLoadingServers(true);
        
        // localStorage에서 Supabase로 마이그레이션 (한 번만 실행)
        await migrateLocalStorageToSupabase();
        
        // Supabase에서 서버 로드
        const loadedServers = await getStoredServers();
        setServers(loadedServers);
        
        // 활성화 상태 로드
        const res = await fetch('/api/mcp/servers/enabled?all=true');
        if (res.ok) {
          const data = await res.json();
          const states = data.states || [];
          const enabledMap = new Map<string, boolean>();
          for (const state of states) {
            enabledMap.set(state.id, state.enabled);
          }
          setServerEnabledStates(enabledMap);
        } else {
          // 기본값: 모두 활성화
          const enabledMap = new Map<string, boolean>();
          for (const server of loadedServers) {
            enabledMap.set(server.id, true);
          }
          setServerEnabledStates(enabledMap);
        }
      } catch (error) {
        console.error('Failed to load servers:', error);
      } finally {
        setLoadingServers(false);
      }
    };
    loadServers();
  }, []);

  // 서버 활성화/비활성화 토글
  const handleToggleEnabled = async (serverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentEnabled = serverEnabledStates.get(serverId) ?? true;
    const newEnabled = !currentEnabled;
    
    try {
      const res = await fetch('/api/mcp/servers/enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, enabled: newEnabled }),
      });
      
      if (res.ok) {
        setServerEnabledStates((prev) => {
          const next = new Map(prev);
          next.set(serverId, newEnabled);
          return next;
        });
      } else {
        alert('활성화 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to toggle enabled status:', error);
      alert('활성화 상태 변경에 실패했습니다.');
    }
  };

  const handleSaveServers = async (newServers: ServerConfig[]) => {
    try {
      await saveStoredServers(newServers);
      setServers(newServers);
    } catch (error) {
      console.error('Failed to save servers:', error);
      alert('서버 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleSave = async (config: ServerConfig) => {
    try {
      const index = servers.findIndex((s) => s.id === config.id);
      const newServers = index >= 0
        ? servers.map((s) => (s.id === config.id ? config : s))
        : [...servers, config];
      
      await handleSaveServers(newServers);
      setShowForm(false);
      setEditingServer(undefined);
    } catch (error) {
      console.error('Failed to save server:', error);
      alert('서버 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('이 서버를 삭제하시겠습니까?')) {
      try {
        if (isConnected(id)) {
          await disconnect(id);
          // 상태 변경 이벤트 발생
          window.dispatchEvent(new CustomEvent('mcp-status-changed'));
        }
        
        // API를 통해 삭제
        const res = await fetch(`/api/mcp/servers?id=${id}`, {
          method: 'DELETE',
        });
        
        if (!res.ok) {
          throw new Error('Failed to delete server');
        }
        
        const newServers = servers.filter((s) => s.id !== id);
        setServers(newServers);
        
        // 서버 목록 변경 이벤트 발생
        window.dispatchEvent(new CustomEvent('mcp-status-changed'));
        
        if (selectedServer === id) {
          setSelectedServer(null);
          clearCapabilities();
        }
      } catch (error) {
        console.error('Failed to delete server:', error);
        alert('서버 삭제에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };

  const handleConnect = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;

    setConnectingServer(id);
    const result = await connect(server);
    setConnectingServer(null);

    if (result.success) {
      // 상태 변경 이벤트 발생
      window.dispatchEvent(new CustomEvent('mcp-status-changed'));
      
      if (selectedServer === id) {
        loadCapabilities(id);
      }
    } else {
      alert(`연결 실패: ${result.error || '서버 설정을 확인하세요.'}`);
    }
  };

  const handleDisconnect = async (id: string) => {
    setConnectingServer(id);
    const result = await disconnect(id);
    setConnectingServer(null);

    if (!result.success && result.error) {
      alert(`연결 해제 실패: ${result.error}`);
    } else {
      // 상태 변경 이벤트 발생
      window.dispatchEvent(new CustomEvent('mcp-status-changed'));
    }

    if (selectedServer === id) {
      clearCapabilities();
    }
  };

  const clearCapabilities = () => {
    setTools([]);
    setResources([]);
    setPrompts([]);
    setExecutingTool(null);
    setReadingResource(null);
    setExecutingPrompt(null);
  };

  const loadCapabilities = async (id: string) => {
    setLoadingCapabilities(true);
    clearCapabilities();

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
    } finally {
      setLoadingCapabilities(false);
    }
  };

  const handleSelectServer = (id: string) => {
    setSelectedServer(id);
    clearCapabilities();
    if (isConnected(id)) {
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
          handleSaveServers(imported);
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

  const serverConnected = selectedServer ? isConnected(selectedServer) : false;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 서버 목록 */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Server size={18} />
              서버 목록
              {connectedServers.length > 0 && (
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                  {connectedServers.length}개 연결됨
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {servers.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border border-border rounded-lg">
                  <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                  <p>등록된 서버가 없습니다</p>
                </div>
              ) : (
                servers.map((server) => {
                  const connected = isConnected(server.id);
                  const connecting = connectingServer === server.id;
                  const enabled = serverEnabledStates.get(server.id) ?? true;
                  
                  return (
                    <div
                      key={server.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedServer === server.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted'
                      } ${!enabled ? 'opacity-60' : ''}`}
                      onClick={() => handleSelectServer(server.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                connected ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            />
                            <span className="font-medium truncate">{server.name}</span>
                            {!enabled && (
                              <span className="text-xs text-muted-foreground">(비활성화)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {server.transport}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={(e) => handleToggleEnabled(server.id, e)}
                            className={`p-1 rounded transition-colors ${
                              enabled
                                ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20'
                                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            title={enabled ? '채팅에서 비활성화' : '채팅에서 활성화'}
                          >
                            {enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          {connecting ? (
                            <div className="p-1">
                              <Loader2 size={16} className="animate-spin text-muted-foreground" />
                            </div>
                          ) : connected ? (
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
                  );
                })
              )}
            </div>
          </div>

          {/* 서버 상세 정보 */}
          <div className="lg:col-span-3">
            {selectedServer ? (
              <div className="space-y-6">
                {/* Tools 섹션 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Wrench size={18} />
                    도구 (Tools)
                    {tools.length > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {tools.length}
                      </span>
                    )}
                  </h2>
                  {serverConnected ? (
                    loadingCapabilities ? (
                      <div className="p-8 text-center border border-border rounded-lg">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">로딩 중...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tools.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                            <Wrench size={24} className="mx-auto mb-2 opacity-50" />
                            <p>사용 가능한 도구가 없습니다</p>
                          </div>
                        ) : (
                          tools.map((tool: any) => (
                            <div key={tool.name}>
                              {executingTool === tool.name ? (
                                <ToolExecutor
                                  tool={tool}
                                  serverId={selectedServer}
                                  onClose={() => setExecutingTool(null)}
                                />
                              ) : (
                                <div className="p-3 border border-border rounded-lg flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{tool.name}</div>
                                    {tool.description && (
                                      <div className="text-sm text-muted-foreground mt-1">
                                        {tool.description}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setExecutingTool(tool.name)}
                                    className="ml-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                                  >
                                    <Play size={14} />
                                    실행
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                      <PowerOff size={24} className="mx-auto mb-2 opacity-50" />
                      <p>서버에 연결하세요</p>
                    </div>
                  )}
                </div>

                {/* Resources 섹션 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FolderOpen size={18} />
                    리소스 (Resources)
                    {resources.length > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {resources.length}
                      </span>
                    )}
                  </h2>
                  {serverConnected ? (
                    loadingCapabilities ? (
                      <div className="p-8 text-center border border-border rounded-lg">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">로딩 중...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {resources.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                            <FolderOpen size={24} className="mx-auto mb-2 opacity-50" />
                            <p>사용 가능한 리소스가 없습니다</p>
                          </div>
                        ) : (
                          resources.map((resource: any) => (
                            <div key={resource.uri}>
                              {readingResource === resource.uri ? (
                                <ResourceReader
                                  resource={resource}
                                  serverId={selectedServer}
                                  onClose={() => setReadingResource(null)}
                                />
                              ) : (
                                <div className="p-3 border border-border rounded-lg flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{resource.name || resource.uri}</div>
                                    {resource.description && (
                                      <div className="text-sm text-muted-foreground mt-1">
                                        {resource.description}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                                      {resource.uri}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setReadingResource(resource.uri)}
                                    className="ml-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                                  >
                                    <Eye size={14} />
                                    읽기
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                      <PowerOff size={24} className="mx-auto mb-2 opacity-50" />
                      <p>서버에 연결하세요</p>
                    </div>
                  )}
                </div>

                {/* Prompts 섹션 */}
                <div>
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileText size={18} />
                    프롬프트 (Prompts)
                    {prompts.length > 0 && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                        {prompts.length}
                      </span>
                    )}
                  </h2>
                  {serverConnected ? (
                    loadingCapabilities ? (
                      <div className="p-8 text-center border border-border rounded-lg">
                        <Loader2 size={24} className="mx-auto mb-2 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">로딩 중...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {prompts.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground border border-border rounded-lg">
                            <FileText size={24} className="mx-auto mb-2 opacity-50" />
                            <p>사용 가능한 프롬프트가 없습니다</p>
                          </div>
                        ) : (
                          prompts.map((prompt: any) => (
                            <div key={prompt.name}>
                              {executingPrompt === prompt.name ? (
                                <PromptExecutor
                                  prompt={prompt}
                                  serverId={selectedServer}
                                  onClose={() => setExecutingPrompt(null)}
                                />
                              ) : (
                                <div className="p-3 border border-border rounded-lg flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{prompt.name}</div>
                                    {prompt.description && (
                                      <div className="text-sm text-muted-foreground mt-1">
                                        {prompt.description}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setExecutingPrompt(prompt.name)}
                                    className="ml-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                                  >
                                    <MessageSquare size={14} />
                                    실행
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )
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
