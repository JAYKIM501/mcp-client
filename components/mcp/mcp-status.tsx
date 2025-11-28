'use client';

import { useState, useEffect } from 'react';
import { Server } from 'lucide-react';

export function MCPStatus() {
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/mcp/status');
        const data = await res.json();
        setConnectedCount(data.connected || 0);
      } catch (error) {
        console.error('Failed to check MCP status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (connectedCount === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <Server size={16} className={connectedCount > 0 ? 'text-green-500' : ''} />
      <span>{connectedCount}</span>
    </div>
  );
}

