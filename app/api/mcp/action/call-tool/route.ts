import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp-manager';

// POST: 도구 실행
export async function POST(request: NextRequest) {
  try {
    const { serverId, toolName, arguments: args } = await request.json();

    if (!serverId || !toolName) {
      return NextResponse.json(
        { error: 'serverId and toolName are required' },
        { status: 400 }
      );
    }

    const result = await mcpManager.callTool(serverId, toolName, args || {});
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to call tool' },
      { status: 500 }
    );
  }
}

