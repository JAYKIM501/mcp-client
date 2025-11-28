'use client';

import { useMCP } from '@/lib/mcp-context';
import { Server, Loader2 } from 'lucide-react';

export function MCPStatus() {
  const { connectedServers, isLoading } = useMCP();
  const connectedCount = connectedServers.length;

  if (connectedCount === 0 && !isLoading) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Server size={16} className={connectedCount > 0 ? 'text-green-500' : ''} />
      )}
      <span className={connectedCount > 0 ? 'text-green-600 dark:text-green-400' : ''}>
        {connectedCount}
      </span>
    </div>
  );
}
