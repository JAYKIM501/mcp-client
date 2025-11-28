import { NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp-manager';

// GET: 연결 상태 조회
export async function GET() {
  try {
    const servers = mcpManager.getConnectedServers();
    return NextResponse.json({
      connected: servers.length,
      servers: servers.map((s) => ({
        id: s.id,
        name: s.name,
        transport: s.transport,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

