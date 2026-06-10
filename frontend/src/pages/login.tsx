import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/auth/login', {
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

      localStorage.setItem('rbms_token', result.access_token);
      router.push('/');
    } catch (err) {
      setError('Unable to reach backend.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-10 shadow-xl shadow-slate-200/70">
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="mt-2 text-slate-600">
          Use one of the demo accounts: <strong>admin/password</strong>, <strong>moderator/password</strong>, <strong>user/password</strong>, or <strong>guest/guest</strong>.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-slate-900 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
