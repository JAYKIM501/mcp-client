import { NextRequest, NextResponse } from 'next/server';
import { mcpStorage } from '@/lib/mcp-storage';

// GET: 활성화된 서버 목록 조회 또는 모든 서버의 활성화 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    
    if (all) {
      // 모든 서버의 활성화 상태 반환
      const allServers = await mcpStorage.getAllServers();
      const enabledServers = await mcpStorage.getEnabledServers();
      const enabledIds = new Set(enabledServers.map((s) => s.id));
      
      const states = allServers.map((server) => ({
        id: server.id,
        enabled: enabledIds.has(server.id),
      }));
      
      return NextResponse.json({ states });
    } else {
      // 활성화된 서버만 반환
      const servers = await mcpStorage.getEnabledServers();
      return NextResponse.json({ servers });
    }
  } catch (error: unknown) {
    console.error('[MCP Servers Enabled API] Failed to get enabled servers:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to load enabled servers';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST: 서버 활성화 상태 변경
export async function POST(request: NextRequest) {
  try {
    const { serverId, enabled } = await request.json();

    if (!serverId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'serverId and enabled (boolean) are required' },
        { status: 400 }
      );
    }

    await mcpStorage.setServerEnabled(serverId, enabled);
    return NextResponse.json({ success: true, message: 'Server enabled status updated' });
  } catch (error: unknown) {
    console.error('[MCP Servers Enabled API] Failed to update enabled status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update enabled status';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

