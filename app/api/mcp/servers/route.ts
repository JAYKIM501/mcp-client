import { NextRequest, NextResponse } from 'next/server';
import { mcpStorage } from '@/lib/mcp-storage';
import { ServerConfigSchema } from '@/lib/mcp-manager';

// GET: 모든 서버 조회
export async function GET() {
  try {
    const servers = await mcpStorage.getAllServers();
    return NextResponse.json({ servers });
  } catch (error: any) {
    console.error('[MCP Servers API] Failed to get servers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load servers' },
      { status: 500 }
    );
  }
}

// POST: 서버 저장 (단일 또는 전체)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 배열인 경우: 전체 서버 목록 저장
    if (Array.isArray(body)) {
      const servers = body.map((s) => ServerConfigSchema.parse(s));
      await mcpStorage.saveAllServers(servers);
      return NextResponse.json({ success: true, message: 'Servers saved' });
    }

    // 단일 서버인 경우: 단일 서버 저장
    const config = ServerConfigSchema.parse(body);
    await mcpStorage.saveServer(config);
    return NextResponse.json({ success: true, message: 'Server saved' });
  } catch (error: any) {
    console.error('[MCP Servers API] Failed to save server:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save server' },
      { status: 500 }
    );
  }
}

// DELETE: 서버 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    await mcpStorage.deleteServer(id);
    return NextResponse.json({ success: true, message: 'Server deleted' });
  } catch (error: any) {
    console.error('[MCP Servers API] Failed to delete server:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete server' },
      { status: 500 }
    );
  }
}

