import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp-manager';

// POST: 프롬프트 가져오기
export async function POST(request: NextRequest) {
  try {
    const { serverId, name, arguments: args } = await request.json();

    if (!serverId || !name) {
      return NextResponse.json(
        { error: 'serverId and name are required' },
        { status: 400 }
      );
    }

    const result = await mcpManager.getPrompt(serverId, name, args || {});
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get prompt' },
      { status: 500 }
    );
  }
}

