import { ThemeToggle } from '@/components/ui/theme-toggle';
import { MessageSquare, Settings } from 'lucide-react';
import Link from 'next/link';

export default function MCPLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold hover:underline">
              <MessageSquare size={20} />
              AI 채팅
            </Link>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <span className="text-lg font-medium">MCP 관리</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}

