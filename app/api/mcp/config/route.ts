import { NextRequest, NextResponse } from 'next/server';
import { ServerConfigSchema } from '@/lib/mcp-manager';
import { z } from 'zod';

const STORAGE_KEY = 'mcp-servers';

// GET: 서버 설정 목록 조회
export async function GET() {
  try {
    // 클라이언트에서 관리하므로 빈 배열 반환
    // 실제로는 클라이언트의 localStorage에서 읽어옴
    return NextResponse.json({ servers: [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load server configs' },
      { status: 500 }
    );
  }
}

// POST: 서버 설정 저장 (검증용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = ServerConfigSchema.parse(body);
    
    // 검증만 수행 (실제 저장은 클라이언트에서)
    return NextResponse.json({ success: true, config });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid server config', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to validate server config' },
      { status: 500 }
    );
  }
}

