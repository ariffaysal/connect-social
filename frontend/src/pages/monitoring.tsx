import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken } from '../lib/auth';
import { timeAgo } from '../lib/format';

type Overview = {
  totalUsers: number;
  activeToday: number;
  activeSince24h: number;
  totalPosts: number;
  totalComments: number;
  totalReactions: number;
  pendingReports: number;
  newUsersWeek: number;
  postsWeek: number;
  commentsWeek: number;
  reactionsWeek: number;
};

type TimelinePoint = { day: string; posts: number; comments: number; logins: number };

type TopUser = {
  userId: number;
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
  const [tab, setTab] = useState<'overview' | 'leaderboard' | 'activity'>('overview');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
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
        { label: 'Pending reports', value: overview.pendingReports, icon: '🚩' },
      ]
    : [];

  const tabs: { key: typeof tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'leaderboard', label: 'Top Users' },
    { key: 'activity', label: 'Activity Log' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNav profile={profile} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Monitoring & Analytics</h1>
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
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
      </div>
    </div>
  );
}
