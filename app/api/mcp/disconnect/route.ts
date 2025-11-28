import { NextRequest, NextResponse } from 'next/server';

// POST: 서버 연결 해제
export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId || typeof serverId !== 'string') {
      return NextResponse.json(
        { error: 'serverId is required' },
        { status: 400 }
      );
    }

    const { mcpManager } = await import('@/lib/mcp-manager');
    await mcpManager.disconnect(serverId);

    return NextResponse.json({ success: true, message: 'Disconnected' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

