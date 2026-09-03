import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken } from '../lib/auth';
import { timeAgo } from '../lib/format';

type Notification = {
  id: number;
  recipientId: number;
  actorId: number;
  actorUsername: string;
  type: 'comment' | 'reaction' | 'mention' | 'system';
  postId?: number;
  commentId?: number;
  content: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_META: Record<string, { emoji: string; label: string }> = {
  comment: { emoji: '💬', label: 'commented' },
  reaction: { emoji: '👍', label: 'reacted' },
  mention: { emoji: '@', label: 'mentioned you' },
  system: { emoji: '⚙️', label: 'system' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      setNotifications(await apiFetch<Notification[]>('/notifications'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: number) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err: any) {
      setError(err.message);
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNav profile={profile} />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-slate-500">
              {unread > 0 ? `${unread} unread` : 'You’re all caught up'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Mark all read
            </button>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        )}

        {loading ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Loading…
          </p>
        ) : notifications.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No notifications yet. When someone comments on or reacts to your posts, it'll show up here.
          </p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] ?? { emoji: '🔔', label: n.type };
              const body = (
                <div
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 shadow-sm transition hover:bg-slate-50 ${
                    n.isRead ? 'bg-white' : 'bg-indigo-50/60'
                  }`}
                  onClick={() => {
                    if (!n.isRead) markRead(n.id);
                  }}
                >
                  <Link href={`/profile/${n.actorId}`} onClick={(e) => e.stopPropagation()}>
                    <Avatar name={n.actorUsername} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-slate-900">
                        {n.actorUsername}
                      </span>{' '}
                      <span className="text-slate-400">{meta.label}</span>
                      <span className="ml-2">{meta.emoji}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{n.content}</p>
                    <span className="mt-1 block text-xs text-slate-400">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                  )}
                </div>
              );

              return n.postId ? (
                <Link key={n.id} href={`/feed?post=${n.postId}`} onClick={(e) => e.stopPropagation()}>
                  {body}
                </Link>
              ) : (
                <div key={n.id}>{body}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
