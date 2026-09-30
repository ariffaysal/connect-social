import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import MessageThread, { MessagePartner } from '../components/MessageThread';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken, Profile } from '../lib/auth';
import { timeAgo } from '../lib/format';
import { ConversationSummary, retentionLabel } from '../lib/messages';

const POLL_MS = 15000;

export default function MessagesPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [partner, setPartner] = useState<MessagePartner | null>(null);
  const [retentionMinutes, setRetentionMinutes] = useState(60);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [list, retention] = await Promise.all([
        apiFetch<ConversationSummary[]>('/messages/conversations'),
        apiFetch<{ retentionMinutes: number }>('/messages/retention'),
      ]);
      setConversations(list);
      setRetentionMinutes(retention.retentionMinutes ?? 60);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=/messages');
      return;
    }
    void loadConversations(true);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void loadConversations();
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?with=<id> opens that conversation (linked from profiles and toasts).
  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.with;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && Number.isFinite(Number(value))) setSelected(Number(value));
  }, [router.isReady, router.query.with]);

  // Resolve who we're talking to: prefer the loaded conversation, and fall
  // back to the user profile for links arriving from elsewhere.
  useEffect(() => {
    if (selected === null) {
      setPartner(null);
      return;
    }
    const known = conversations.find((c) => c.otherUserId === selected);
    if (known) {
      setPartner((previous) =>
        previous && previous.userId === selected
          ? previous
          : {
              userId: known.otherUserId,
              username: known.otherUsername,
              fullName: known.otherFullName,
              avatarUrl: known.otherAvatarUrl,
            },
      );
      return;
    }

    let cancelled = false;
    apiFetch<Profile>(`/users/${selected}`)
      .then((user) => {
        if (cancelled) return;
        setPartner({
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, conversations]);

  const openConversation = (userId: number) => {
    setSelected(userId);
    void router.replace({ pathname: '/messages', query: { with: String(userId) } }, undefined, {
      shallow: true,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Head>
        <title>Messages — ConnectSocial</title>
        <meta name="description" content="Direct messages with your colleagues." />
      </Head>
      <TopNav profile={profile} />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-sm text-slate-500">
              🔒 Conversations are automatically deleted after{' '}
              {retentionLabel(retentionMinutes)}.
            </p>
          </div>
          <Link
            href="/feed"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Find people on the feed
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        )}

        <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
          <aside className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              Active conversations
            </h2>
            <div className="max-h-[32rem] overflow-y-auto">
              {loading && conversations.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
              )}
              {!loading && conversations.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  No active conversations. Open a profile and hit{' '}
                  <span className="font-medium text-slate-700">Message</span> to start one.
                </p>
              )}
              {conversations.map((conversation) => {
                const active = selected === conversation.otherUserId;
                const name =
                  conversation.otherFullName || conversation.otherUsername;
                return (
                  <button
                    key={conversation.otherUserId}
                    type="button"
                    onClick={() => openConversation(conversation.otherUserId)}
                    className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition ${
                      active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Avatar name={name} avatarUrl={conversation.otherAvatarUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {timeAgo(conversation.lastAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {conversation.lastFromMe ? 'You: ' : ''}
                        {conversation.lastMessage}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {partner && profile ? (
            <MessageThread
              partner={partner}
              currentUserId={profile.userId}
              onMessageSent={() => void loadConversations()}
              className="h-[32rem]"
            />
          ) : (
            <div className="flex h-[32rem] items-center justify-center rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Select a conversation, or open a colleague&apos;s profile and press
              &ldquo;Message&rdquo;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
