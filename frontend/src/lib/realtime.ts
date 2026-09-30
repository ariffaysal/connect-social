import { API_URL } from './api';
import { getToken } from './auth';

/**
 * One shared WebSocket connection for the whole app.
 *
 * Every component that wants live updates (nav badges, the messages inbox, an
 * open conversation, the monitoring console) subscribes here instead of
 * opening its own socket. The connection is opened on the first subscriber and
 * closed when the last one unsubscribes, with automatic reconnect.
 *
 * Server events are `{ type, ...payload }`. `emitRealtime` dispatches a
 * local-only event through the same handlers, which lets a component tell the
 * rest of the UI about something it just did without a server round-trip
 * (e.g. "I just read this conversation, clear the badge").
 */

type Handler = (payload: any) => void;

const handlers = new Map<string, Set<Handler>>();
let socket: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let activeToken: string | null = null;
let subscribers = 0;

function dispatch(payload: any) {
  if (!payload?.type) return;
  const set = handlers.get(payload.type);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch {
      /* a broken listener must not break the others */
    }
  }
}

function closeSocket() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (socket) {
    const current = socket;
    socket = null;
    current.onclose = null;
    current.close();
  }
  activeToken = null;
}

function openSocket() {
  if (socket) return;
  const token = getToken();
  if (!token) return;
  const base = API_URL.replace(/^http/, 'ws');
  activeToken = token;
  let next: WebSocket;
  try {
    next = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);
  } catch {
    return;
  }
  socket = next;
  next.onmessage = (event) => {
    try {
      dispatch(JSON.parse(String(event.data)));
    } catch {
      /* ignore malformed frames */
    }
  };
  next.onerror = () => next.close();
  next.onclose = () => {
    if (socket === next) socket = null;
    if (subscribers > 0) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        openSocket();
      }, 4000);
    }
  };
}

/** Reconnect if the signed-in user changed (login/logout in the same tab). */
export function syncRealtimeToken() {
  if (activeToken === getToken()) return;
  closeSocket();
  if (subscribers > 0) openSocket();
}

/** Subscribe to a live event type. Returns an unsubscribe function. */
export function subscribeRealtime(type: string, handler: Handler): () => void {
  const set = handlers.get(type) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(type, set);
  subscribers += 1;
  if (activeToken !== getToken()) closeSocket();
  openSocket();

  return () => {
    const current = handlers.get(type);
    current?.delete(handler);
    if (current && current.size === 0) handlers.delete(type);
    subscribers = Math.max(0, subscribers - 1);
    if (subscribers === 0) closeSocket();
  };
}

/** Notify local subscribers only — no server round-trip. */
export function emitRealtime(type: string, payload: Record<string, unknown> = {}) {
  dispatch({ type, ...payload });
}
