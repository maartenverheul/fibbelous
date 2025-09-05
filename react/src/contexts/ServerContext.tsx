import { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import { Command } from '@/models/commands';
import { Workspace } from '@/models';

// Result type can be imported later if needed

export interface ServerContextValue {
  status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  lastError?: string;
  dispatch<T = unknown>(command: Command): Promise<T>;
}

export const ServerContext = createContext<ServerContextValue | undefined>(undefined);

export function ServerProvider({ children, workspace }: { children: ReactNode, workspace?: Workspace }) {
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ServerContextValue['status']>('idle');
  const [lastError, setLastError] = useState<string | undefined>();
  const pending = useRef(new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>());

  // Simple id generator
  function nextId() { return Math.random().toString(36).slice(2, 10); }

  // (Re)connect when active workspace changes
  useEffect(() => {
    if (socketRef.current) {
      try { socketRef.current.close(); } catch { }
      socketRef.current = null;
    }
    if (!workspace?.info?.id) { setStatus('idle'); return; }
    setStatus('connecting'); setLastError(undefined);
    const base = import.meta.env.VITE_SERVER_WS_URL ?? 'ws://localhost:3001/ws';
    const wsUrl = `${base}?workspace=${encodeURIComponent(workspace.info.id)}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.onopen = () => setStatus('open');
    ws.onerror = () => { setLastError('socket error'); setStatus('error'); };
    ws.onclose = () => { setStatus('closed'); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const { id, result, error } = msg;
        if (id && pending.current.has(id)) {
          const { resolve, reject } = pending.current.get(id)!;
          pending.current.delete(id);
          if (error) reject(new Error(error)); else resolve(result);
        }
      } catch (e) {
        console.warn('Server message parse failed', e);
      }
    };
    return () => { try { ws.close(); } catch { } };
  }, [workspace?.info?.id]);

  async function dispatch<T = unknown>(command: Command): Promise<T> {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('Socket not open');
    }
    const id = nextId();
    const payload = { id, command };
    const p = new Promise<T>((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.current.has(id)) {
          pending.current.delete(id);
          reject(new Error('Timeout'));
        }
      }, 15000);
    });
    socketRef.current.send(JSON.stringify(payload));
    return p;
  }

  if (workspace) return children;

  return <ServerContext.Provider value={{ status, lastError, dispatch }}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within ServerProvider');
  return ctx;
}
