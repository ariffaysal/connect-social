import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken, isModOrAdmin } from '../lib/auth';
import { timeAgo } from '../lib/format';

type Report = {
  id: number;
  targetType: 'post' | 'comment';
  targetId: number;
  reason: string;
  reporterId: number;
  reporterUsername: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  resolvedById?: number;
  target?: {
    id: number;
    title?: string;
    content?: string;
    ownerId?: number;
    ownerUsername?: string;
    createdAt?: string;
    post?: { id: number; title?: string; ownerUsername?: string };
  };
};

export default function ModerationPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<'pending' | 'resolved' | 'dismissed'>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (profile && !isModOrAdmin(profile.role)) {
      router.push('/feed');
      return;
    }
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const load = async () => {
    try {
      setLoading(true);
      setReports(await apiFetch<Report[]>(`/reports?status=${status}`));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && isModOrAdmin(profile.role)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const resolve = async (report: Report, deleteTarget: boolean) => {
    if (deleteTarget && !window.confirm('Delete the reported content permanently?')) return;
    setBusyId(report.id);
    try {
      await apiFetch(`/reports/${report.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ deleteTarget }),
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (report: Report) => {
    setBusyId(report.id);
    try {
      await apiFetch(`/reports/${report.id}/dismiss`, { method: 'PATCH' });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const tabs: { key: typeof status; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNav profile={profile} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Moderation Queue</h1>
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  status === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
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

        {loading ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Loading…
          </p>
        ) : reports.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            No {status === 'pending' ? 'pending' : ''} reports{' '}
            {status !== 'pending' ? `in "${status}" state` : 'to review'}. All clear! 🎉
          </p>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={report.reporterUsername} size="sm" />
                    <div>
                      <p className="text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {report.reporterUsername}
                        </span>{' '}
                        reported a{' '}
                        <span className="font-semibold uppercase text-slate-500">
                          {report.targetType}
                        </span>
                      </p>
                      <span className="text-xs text-slate-400">
                        {timeAgo(report.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      report.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : report.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {report.status}
                  </span>
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Report reason
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{report.reason}</p>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Reported {report.targetType} content
                  </p>
                  {report.target ? (
                    <div className="mt-2">
                      {report.targetType === 'post' ? (
                        <>
                          <p className="text-sm font-semibold text-slate-900">
                            {report.target.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{report.target.content}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-slate-600">{report.target.content}</p>
                          {report.target.post && (
                            <p className="mt-1 text-xs text-slate-400">
                              on post “{report.target.post.title}” by{' '}
                              {report.target.post.ownerUsername}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">
                      Content has already been removed.
                    </p>
                  )}
                </div>

                {report.status === 'pending' && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      disabled={busyId === report.id}
                      onClick={() => resolve(report, false)}
                      className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Resolve (keep content)
                    </button>
                    <button
                      disabled={busyId === report.id}
                      onClick={() => resolve(report, true)}
                      className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      Resolve & delete content
                    </button>
                    <button
                      disabled={busyId === report.id}
                      onClick={() => dismiss(report)}
                      className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
