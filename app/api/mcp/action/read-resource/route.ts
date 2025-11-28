import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp-manager';

// POST: 리소스 읽기
export async function POST(request: NextRequest) {
  try {
    const { serverId, uri } = await request.json();

    if (!serverId || !uri) {
      return NextResponse.json(
        { error: 'serverId and uri are required' },
        { status: 400 }
      );
    }

    const result = await mcpManager.readResource(serverId, uri);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to read resource' },
      { status: 500 }
    );
  }
}

