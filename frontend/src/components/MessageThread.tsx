import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import { apiFetch } from '../lib/auth';
import {
  DirectMessage,
  MessagePage,
  clockTime,
  dayLabel,
  isSameDay,
  retentionLabel,
} from '../lib/messages';

const POLL_MS = 8000;

export type MessagePartner = {
  userId: number;
  username: string;
  fullName?: string;
  avatarUrl?: string;
};

export default function MessageThread({
  partner,
  currentUserId,
  onClose,
  onMessageSent,
  className = '',
}: {
  partner: MessagePartner;
  currentUserId: number;
  onClose?: () => void;
  /** Called after a message is sent (e.g. to refresh a conversation list). */
  onMessageSent?: () => void;
  className?: string;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [retentionMinutes, setRetentionMinutes] = useState(60);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSignature = useRef('');

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const page = await apiFetch<MessagePage>(
          `/messages/with/${partner.userId}?limit=200`,
        );
        setMessages(page.messages);
        setRetentionMinutes(page.retentionMinutes ?? 60);
        setError('');
      } catch (err: any) {
        setError(err.message);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [partner.userId],
  );

  useEffect(() => {
    setMessages([]);
    lastSignature.current = '';
    setDraft('');
    void load(true);
  }, [load]);

  // Keep the thread fresh (the backend purges old messages continuously).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const interval = setInterval(refresh, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  // Pin to the newest message whenever the list changes.
  useEffect(() => {
    const signature = messages.map((m) => m.id).join(',');
    if (signature === lastSignature.current) return;
    lastSignature.current = signature;
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId: partner.userId, content }),
      });
      setDraft('');
      await load();
      onMessageSent?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const name = partner.fullName || partner.username;

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ${className}`}
      aria-label={`Conversation with ${name}`}
    >
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <Avatar name={name} avatarUrl={partner.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${partner.userId}`}
            className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-600"
          >
            {name}
          </Link>
          <p className="truncate text-xs text-slate-400">@{partner.username}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close conversation"
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-slate-50 px-4 py-3">
        {loading && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">Loading messages…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            No messages yet — say hello 👋
          </p>
        )}
        {messages.map((message, index) => {
          const mine = message.senderId === currentUserId;
          const previous = index > 0 ? messages[index - 1] : undefined;
          const showDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
          return (
            <div key={message.id}>
              {showDay && (
                <p className="my-3 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {dayLabel(message.createdAt)}
                </p>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mine
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      mine ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {clockTime(message.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <p className="mb-2 text-[11px] text-slate-400">
          🔒 Messages are automatically deleted after {retentionLabel(retentionMinutes)}.
        </p>
        {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Message ${name.split(' ')[0]}…`}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? '…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  );
}
