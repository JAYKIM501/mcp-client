import { NextRequest, NextResponse } from 'next/server';
import { mcpManager, ServerConfigSchema } from '@/lib/mcp-manager';

// POST: 서버 연결
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = ServerConfigSchema.parse(body);

    await mcpManager.connect(config);

    return NextResponse.json({ success: true, message: 'Connected' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to connect' },
      { status: 500 }
    );
  }
}

