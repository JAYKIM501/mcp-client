import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp-manager';

// GET: 프롬프트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    if (!serverId) {
      return NextResponse.json(
        { error: 'serverId is required' },
        { status: 400 }
      );
    }

    const result = await mcpManager.listPrompts(serverId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list prompts';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

