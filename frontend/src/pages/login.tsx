import Head from 'next/head';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { API_URL } from '../lib/api';
import { clearToken, fetchProfile, getToken } from '../lib/auth';

/** Only allow local paths as ?next= targets, blocking open redirects. */
function safeNext(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    return null;
  }
  return raw;
}

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const next = safeNext(router.query.next);

  // Already signed in? Skip the form and continue where the user was headed.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    fetchProfile()
      .then(() => {
        if (!cancelled) router.replace(next || '/feed');
      })
      .catch(() => {
        // Token is stale/expired — drop it so the form can be used.
        if (!cancelled) clearToken();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.message || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem('connectsocial_token', result.access_token);
      router.push(next || '/feed');
    } catch (err) {
      setError('Unable to reach backend.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <Head>
        <title>Login — ConnectSocial</title>
        <meta name="description" content="Sign in to ConnectSocial to catch up with your team." />
      </Head>
      <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-xl shadow-slate-200/70">
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="mt-2 text-slate-600">
          Sign in with your ConnectSocial account.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-slate-900 focus:outline-none"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}