import { NextRequest, NextResponse } from 'next/server';
import { mcpManager, ServerConfigSchema } from '@/lib/mcp-manager';

// POST: 서버 연결
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = ServerConfigSchema.parse(body);

    // 이미 연결되어 있는지 실제 연결 상태를 확인
    const connectedServers = mcpManager.getConnectedServers();
    const actuallyConnected = connectedServers.some(s => s.id === config.id);
    
    if (actuallyConnected) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already connected',
        alreadyConnected: true 
      });
    }

    await mcpManager.connect(config);

    return NextResponse.json({ success: true, message: 'Connected' });
  } catch (error: any) {
    // "already connected" 에러는 성공으로 처리
    if (error.message?.includes('already connected')) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already connected',
        alreadyConnected: true 
      });
    }

    console.error('[MCP Connect] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect' },
      { status: 500 }
    );
  }
}

