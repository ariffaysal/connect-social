import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken } from '../lib/auth';
import { subscribeRealtime } from '../lib/realtime';
import { timeAgo } from '../lib/format';
import {
  AdminConversationSummary,
  MonitoredMessage,
  clockTime,
  retentionLabel,
} from '../lib/messages';

type Overview = {
  totalUsers: number;
  activeToday: number;
  activeSince24h: number;
  totalPosts: number;
  totalComments: number;
  totalReactions: number;
  activeConversations: number;
  pendingReports: number;
  newUsersWeek: number;
  postsWeek: number;
  commentsWeek: number;
  reactionsWeek: number;
};

type TimelinePoint = { day: string; posts: number; comments: number; logins: number };

type TopUser = {
  userId: number;
  publicId?: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  departmentId?: number;
  posts: number;
  comments: number;
  reactions: number;
  engagement: number;
};

type Activity = {
  id: number;
  userId: number;
  username: string;
  action: string;
  detail?: string;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  login: 'Signed in',
  post_created: 'Created a post',
  comment_created: 'Commented',
  reaction_added: 'Reacted',
  report_filed: 'Filed a report',
  moderation: 'Moderated content',
  message_sent: 'Sent a direct message',
  message_reviewed: 'Reviewed private messages',
  account_created: 'Created an account',
  account_updated: 'Updated an account',
  profile_updated: 'Updated profile',
};

export default function MonitoringPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [monitored, setMonitored] = useState<AdminConversationSummary | null>(null);
  const [monitoredMessages, setMonitoredMessages] = useState<MonitoredMessage[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [messageRetention, setMessageRetention] = useState<{
    retentionMinutes: number;
    auditRetentionHours: number;
    auditEnabled: boolean;
  } | null>(null);
  const [tab, setTab] = useState<'overview' | 'leaderboard' | 'activity' | 'conversations'>(
    'overview',
  );
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=/monitoring');
      return;
    }
    if (profile && profile.role !== 'SuperAdmin') {
      router.push('/feed');
      return;
    }
    if (profile) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const loadAll = async () => {
    try {
      const [ov, tl, tu, act] = await Promise.all([
        apiFetch<Overview>('/monitoring/overview'),
        apiFetch<TimelinePoint[]>('/monitoring/timeline?days=7'),
        apiFetch<TopUser[]>('/monitoring/top-users?limit=10'),
        apiFetch<Activity[]>('/monitoring/activity?limit=50'),
      ]);
      setOverview(ov);
      setTimeline(tl);
      setTopUsers(tu);
      setActivity(act);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadConversations = async () => {
    try {
      const [list, retention] = await Promise.all([
        apiFetch<AdminConversationSummary[]>('/messages/admin/conversations?limit=50'),
        apiFetch<{
          retentionMinutes: number;
          auditRetentionHours: number;
          auditEnabled: boolean;
        }>('/messages/retention'),
      ]);
      setConversations(list);
      setMessageRetention(retention);
      setConversationsLoaded(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openMonitoredConversation = async (
    conversation: AdminConversationSummary,
    { clear = true }: { clear?: boolean } = {},
  ) => {
    setMonitored(conversation);
    if (clear) setMonitoredMessages([]);
    try {
      const page = await apiFetch<{ messages: MonitoredMessage[] }>(
        `/messages/admin/thread?userA=${conversation.participantA.userId}&userB=${conversation.participantB.userId}&limit=200`,
      );
      setMonitoredMessages(page.messages);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Management monitoring is live: every direct message refreshes the
  // conversation list (the backend broadcasts messages:new to moderators).
  useEffect(() => {
    if (!conversationsLoaded) return;
    return subscribeRealtime('messages:new', () => {
      void loadConversations();
      if (monitored) void openMonitoredConversation(monitored, { clear: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationsLoaded, monitored]);

  const handleTabChange = (next: typeof tab) => {
    setTab(next);
    if (next === 'conversations' && !conversationsLoaded) void loadConversations();
    if (next !== 'conversations') {
      setMonitored(null);
      setMonitoredMessages([]);
    }
  };

  const loadUserActivity = async (userId: number) => {
    setSelectedUser(userId);
    try {
      setActivity(await apiFetch<Activity[]>(`/monitoring/activity/user/${userId}?limit=50`));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const maxTimeline = Math.max(
    1,
    ...timeline.flatMap((t) => [t.posts, t.comments, t.logins]),
  );

  const kpis: { label: string; value: number; icon: string }[] = overview
    ? [
        { label: 'Total users', value: overview.totalUsers, icon: '👥' },
        { label: 'Active today', value: overview.activeToday, icon: '✅' },
        { label: 'Active 24h', value: overview.activeSince24h, icon: '🟢' },
        { label: 'New users (7d)', value: overview.newUsersWeek, icon: '✨' },
        { label: 'Posts', value: overview.totalPosts, icon: '📝' },
        { label: 'Comments', value: overview.totalComments, icon: '💬' },
        { label: 'Reactions', value: overview.totalReactions, icon: '👍' },
        { label: 'Active chats', value: overview.activeConversations, icon: '💬' },
        { label: 'Pending reports', value: overview.pendingReports, icon: '🚩' },
      ]
    : [];

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'leaderboard', label: 'Top Users' },
    { key: 'activity', label: 'Activity Log' },
    { key: 'conversations', label: 'Conversations' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Head>
        <title>Monitoring & Analytics — ConnectSocial</title>
        <meta name="description" content="Platform activity overview for ConnectSocial admins." />
      </Head>
      <TopNav profile={profile} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Monitoring & Analytics</h1>
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        )}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-2xl">{kpi.icon}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Last 7 days</h2>
              <div className="mt-6 flex items-end justify-between gap-2">
                {timeline.map((point) => {
                  const d = new Date(point.day);
                  return (
                    <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end justify-center gap-1">
                        <div
                          className="w-3 rounded-t bg-indigo-500"
                          style={{ height: `${(point.posts / maxTimeline) * 100}%` }}
                          title={`posts: ${point.posts}`}
                        />
                        <div
                          className="w-3 rounded-t bg-emerald-500"
                          style={{ height: `${(point.comments / maxTimeline) * 100}%` }}
                          title={`comments: ${point.comments}`}
                        />
                        <div
                          className="w-3 rounded-t bg-amber-500"
                          style={{ height: `${(point.logins / maxTimeline) * 100}%` }}
                          title={`logins: ${point.logins}`}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500">
                        {d.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Posts
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Comments
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Logins
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === 'leaderboard' && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Engagement leaderboard</h2>
            <div className="mt-4 space-y-2">
              {topUsers.map((u, index) => (
                <div
                  key={u.userId}
                  className={`flex items-center gap-4 rounded-xl p-3 transition hover:bg-slate-50 ${
                    selectedUser === u.userId ? 'bg-indigo-50' : ''
                  }`}
                >
                  <span className="w-8 text-center text-lg font-bold text-slate-300">
                    {index + 1}
                  </span>
                  <Avatar name={u.fullName || u.username} avatarUrl={u.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{u.fullName || u.username}</p>
                    <p className="text-xs text-slate-500">@{u.username}</p>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.posts}</p>
                      <p className="text-[11px] text-slate-400">posts</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.comments}</p>
                      <p className="text-[11px] text-slate-400">comments</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.reactions}</p>
                      <p className="text-[11px] text-slate-400">reactions</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-600">{u.engagement}</p>
                      <p className="text-[11px] text-slate-400">score</p>
                    </div>
                  </div>
                  <button
                    onClick={() => loadUserActivity(u.userId)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    History
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              {selectedUser ? (
                <span>
                  Activity for user #{selectedUser}{' '}
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      loadAll();
                    }}
                    className="ml-2 text-sm font-medium text-indigo-600 hover:underline"
                  >
                    (show all)
                  </button>
                </span>
              ) : (
                'Recent activity'
              )}
            </h2>
            <div className="mt-4 max-h-[600px] space-y-1 overflow-y-auto">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-xl p-3 hover:bg-slate-50">
                  <Avatar name={entry.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{entry.username}</span>{' '}
                      <span className="text-slate-400">
                        {ACTION_LABEL[entry.action] ?? entry.action}
                      </span>
                      {entry.detail && (
                        <span className="ml-1 text-slate-500">— {entry.detail}</span>
                      )}
                    </p>
                    <span className="text-xs text-slate-400">{timeAgo(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">No activity recorded.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'conversations' && (
          <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Active conversations</h2>
                <button
                  onClick={() => void loadConversations()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Refresh
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Direct messages disappear after{' '}
                {retentionLabel(messageRetention?.retentionMinutes ?? 60)}. This console reads a
                separate audit copy, kept for{' '}
                {messageRetention?.auditRetentionHours
                  ? `${messageRetention.auditRetentionHours} hours`
                  : 'as long as configured'}
                . Opening a transcript is itself recorded in the activity log.
              </p>
              {messageRetention?.auditEnabled === false && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                  Message auditing is disabled on this deployment, so there is nothing to review
                  here. Set <code className="font-mono">MESSAGE_AUDIT_ENABLED=true</code> on the
                  backend to retain conversations for management monitoring.
                </p>
              )}
              <div className="mt-4 max-h-[32rem] space-y-1 overflow-y-auto">
                {conversations.map((conversation) => {
                  const active =
                    monitored?.participantA.userId === conversation.participantA.userId &&
                    monitored?.participantB.userId === conversation.participantB.userId;
                  return (
                    <button
                      key={`${conversation.participantA.userId}:${conversation.participantB.userId}`}
                      onClick={() => void openMonitoredConversation(conversation)}
                      className={`w-full rounded-xl p-3 text-left transition ${
                        active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={conversation.participantA.fullName || conversation.participantA.username}
                          avatarUrl={conversation.participantA.avatarUrl}
                          size="sm"
                        />
                        <span className="text-slate-400">↔</span>
                        <Avatar
                          name={conversation.participantB.fullName || conversation.participantB.username}
                          avatarUrl={conversation.participantB.avatarUrl}
                          size="sm"
                        />
                        <span className="ml-auto text-[11px] text-slate-400">
                          {conversation.messageCount} msg
                        </span>
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-slate-800">
                        {conversation.participantA.username} ↔ {conversation.participantB.username}
                      </p>
                      <p className="truncate text-xs text-slate-500">{conversation.lastMessage}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {timeAgo(conversation.lastAt)}
                      </p>
                    </button>
                  );
                })}
                {conversations.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">
                    No active conversations right now.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {monitored ? (
                <>
                  <h2 className="text-lg font-semibold">
                    {monitored.participantA.username} ↔ {monitored.participantB.username}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Monitored transcript · {monitoredMessages.length} message(s)
                  </p>
                  <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
                    {monitoredMessages.map((message) => (
                      <div key={message.id} className="rounded-xl bg-slate-50 px-4 py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">
                            {message.senderUsername}{' '}
                            <span className="font-normal text-slate-400">
                              → {message.recipientUsername}
                            </span>
                          </p>
                          <span className="text-[11px] text-slate-400">
                            {clockTime(message.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                          {message.content}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">{timeAgo(message.createdAt)}</p>
                      </div>
                    ))}
                    {monitoredMessages.length === 0 && (
                      <p className="py-6 text-center text-sm text-slate-500">Loading transcript…</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="py-24 text-center text-sm text-slate-500">
                  Select a conversation to read the monitored transcript.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
