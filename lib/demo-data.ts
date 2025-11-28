import { ChatSession } from './storage';
import { storage } from './storage';

// 데모 데이터 생성 함수
export function generateDemoData() {
  const now = Date.now();
  const sessions: ChatSession[] = [];

  // 오늘 (3개)
  for (let i = 0; i < 3; i++) {
    const hoursAgo = i * 2; // 0시간 전, 2시간 전, 4시간 전
    const session: ChatSession = {
      id: `demo-today-${i}`,
      title: `오늘의 채팅 ${i + 1}`,
      createdAt: now - hoursAgo * 60 * 60 * 1000,
      updatedAt: now - hoursAgo * 60 * 60 * 1000,
      messages: [
        {
          id: `msg-${i}-1`,
          role: 'user',
          content: `오늘 ${hoursAgo}시간 전에 작성한 메시지입니다. 이것은 테스트용 데모 데이터입니다.`,
        },
        {
          id: `msg-${i}-2`,
          role: 'assistant',
          content: `안녕하세요! 오늘 ${hoursAgo}시간 전의 응답입니다. 데모 데이터 테스트를 위한 응답 메시지입니다.`,
        },
      ],
    };
    sessions.push(session);
  }

  // 어제 (2개)
  const yesterday = now - 24 * 60 * 60 * 1000;
  for (let i = 0; i < 2; i++) {
    const hoursAgo = i * 6; // 0시간 전, 6시간 전
    const session: ChatSession = {
      id: `demo-yesterday-${i}`,
      title: `어제의 채팅 ${i + 1}`,
      createdAt: yesterday - hoursAgo * 60 * 60 * 1000,
      updatedAt: yesterday - hoursAgo * 60 * 60 * 1000,
      messages: [
        {
          id: `msg-yesterday-${i}-1`,
          role: 'user',
          content: `어제 작성한 메시지입니다. 이것은 어제 ${hoursAgo}시간 전의 채팅입니다.`,
        },
        {
          id: `msg-yesterday-${i}-2`,
          role: 'assistant',
          content: `어제의 응답입니다. 데모 데이터를 통해 기간별 분류 기능을 테스트할 수 있습니다.`,
        },
      ],
    };
    sessions.push(session);
  }

  // 지난 7일 (4개)
  for (let i = 0; i < 4; i++) {
    const daysAgo = 2 + i; // 2일 전, 3일 전, 4일 전, 5일 전
    const session: ChatSession = {
      id: `demo-week-${i}`,
      title: `${daysAgo}일 전의 채팅`,
      createdAt: now - daysAgo * 24 * 60 * 60 * 1000,
      updatedAt: now - daysAgo * 24 * 60 * 60 * 1000,
      messages: [
        {
          id: `msg-week-${i}-1`,
          role: 'user',
          content: `${daysAgo}일 전에 작성한 메시지입니다. 지난 7일 이내의 채팅 히스토리 테스트용입니다.`,
        },
        {
          id: `msg-week-${i}-2`,
          role: 'assistant',
          content: `${daysAgo}일 전의 응답입니다. 기간별 그룹화 기능이 제대로 작동하는지 확인할 수 있습니다.`,
        },
      ],
    };
    sessions.push(session);
  }

  // 지난 30일 (5개)
  for (let i = 0; i < 5; i++) {
    const daysAgo = 10 + i * 4; // 10일 전, 14일 전, 18일 전, 22일 전, 26일 전
    const session: ChatSession = {
      id: `demo-month-${i}`,
      title: `${daysAgo}일 전의 채팅`,
      createdAt: now - daysAgo * 24 * 60 * 60 * 1000,
      updatedAt: now - daysAgo * 24 * 60 * 60 * 1000,
      messages: [
        {
          id: `msg-month-${i}-1`,
          role: 'user',
          content: `${daysAgo}일 전에 작성한 메시지입니다. 지난 30일 이내의 채팅 히스토리입니다.`,
        },
        {
          id: `msg-month-${i}-2`,
          role: 'assistant',
          content: `${daysAgo}일 전의 응답입니다. 지난 30일 그룹에 표시되어야 합니다.`,
        },
      ],
    };
    sessions.push(session);
  }

  // 그 이전 (3개)
  for (let i = 0; i < 3; i++) {
    const daysAgo = 35 + i * 10; // 35일 전, 45일 전, 55일 전
    const session: ChatSession = {
      id: `demo-old-${i}`,
      title: `${daysAgo}일 전의 채팅`,
      createdAt: now - daysAgo * 24 * 60 * 60 * 1000,
      updatedAt: now - daysAgo * 24 * 60 * 60 * 1000,
      messages: [
        {
          id: `msg-old-${i}-1`,
          role: 'user',
          content: `${daysAgo}일 전에 작성한 오래된 메시지입니다. 30일 이상 지난 채팅입니다.`,
        },
        {
          id: `msg-old-${i}-2`,
          role: 'assistant',
          content: `${daysAgo}일 전의 응답입니다. "그 이전" 그룹에 표시되어야 합니다.`,
        },
      ],
    };
    sessions.push(session);
  }

  return sessions;
}

// 데모 데이터를 Supabase에 추가 (비동기)
export async function loadDemoDataAsync(): Promise<number> {
  const existingSessions = await storage.getAllSessions();
  const demoSessions = generateDemoData();

  // 기존 데모 데이터 ID 목록
  const existingDemoIds = existingSessions
    .filter((s) => s.id.startsWith('demo-'))
    .map((s) => s.id);

  // 기존 데모 데이터 삭제
  for (const id of existingDemoIds) {
    await storage.deleteSession(id);
  }

  // 제목 자동 생성 및 새 데모 데이터 추가
  for (const session of demoSessions) {
    const title = storage.generateTitleFromMessages(session.messages);
    if (title && title !== '새 채팅') {
      session.title = title;
    }
    await storage.saveSession(session);
  }

  return demoSessions.length;
}

// 동기 버전 (레거시 호환용 - 실제로는 비동기 버전 사용 권장)
export function loadDemoData(): number {
  // 비동기 함수를 호출하고, 완료를 기다리지 않음
  // 사이드바에서 session-changed 이벤트로 갱신됨
  loadDemoDataAsync().catch(console.error);
  return generateDemoData().length;
}

// 데모 데이터 제거 (비동기)
export async function clearDemoDataAsync(): Promise<void> {
  const existingSessions = await storage.getAllSessions();
  const demoIds = existingSessions
    .filter((s) => s.id.startsWith('demo-'))
    .map((s) => s.id);

  for (const id of demoIds) {
    await storage.deleteSession(id);
  }
}

// 동기 버전 (레거시 호환용)
export function clearDemoData(): void {
  clearDemoDataAsync().catch(console.error);
}
