import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { apiFetch, clearToken, getToken, Profile, isModOrAdmin } from '../lib/auth';

export default function TopNav({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!getToken()) return;
    const load = () => {
      apiFetch<number>('/notifications/unread-count')
        .then(setUnread)
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push('/login');
  };

  const navLink = (href: string, label: string) => {
    const active = router.pathname === href;
    return (
      <Link
        href={href}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
          active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <Link href="/feed" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
              C
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              ConnectSocial
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLink('/feed', 'Feed')}
          {profile && isModOrAdmin(profile.role) && navLink('/moderation', 'Moderation')}
          {profile && profile.role === 'SuperAdmin' && navLink('/monitoring', 'Monitoring')}
          {profile && profile.role === 'SuperAdmin' && navLink('/admin', 'Admin')}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className="relative rounded-full p-2 text-slate-700 transition hover:bg-slate-200"
            title="Notifications"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-semibold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>

          {profile ? (
            <Link href="/profile" className="flex items-center gap-2 rounded-full hover:bg-slate-100">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                  {(profile.fullName || profile.username).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hidden text-sm font-medium text-slate-800 sm:block">
                {profile.fullName || profile.username}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Login
            </Link>
          )}

          {profile && (
            <button
              onClick={handleLogout}
              className="rounded-full px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
