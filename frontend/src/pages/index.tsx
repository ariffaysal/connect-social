import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rbms_token') : null;
    if (token) {
      fetch('http://localhost:3001/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setIsLoggedIn(true);
            setRole(data.role);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rbms_token');
    setIsLoggedIn(false);
    setRole('');
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 shadow-xl shadow-slate-200/70">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-semibold tracking-tight">RBMS Task</h1>
          {isLoggedIn && (
            <button onClick={handleLogout} className="text-sm font-medium text-rose-600 hover:text-rose-800 transition">
              Logout
            </button>
          )}
        </div>
        <p className="mt-4 text-slate-600 leading-7">
          A starter monorepo with a Next.js frontend, Tailwind CSS styles, and a NestJS backend using JWT authentication.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {!isLoggedIn ? (
            <Link href="/login" className="rounded-2xl bg-indigo-600 px-5 py-4 text-center text-white font-medium transition hover:bg-indigo-700 sm:col-span-2">
              Login
            </Link>
          ) : (
            <>
              <Link href="/profile" className="rounded-2xl bg-slate-100 px-5 py-4 text-center text-slate-900 font-medium transition hover:bg-slate-200 border border-slate-200">
                Profile
              </Link>
              <Link href="/posts" className="rounded-2xl bg-emerald-600 px-5 py-4 text-center text-white font-medium transition hover:bg-emerald-700">
                View Posts & Comments
              </Link>
              {role === 'SuperAdmin' && (
                <Link href="/admin" className="rounded-2xl bg-rose-600 px-5 py-4 text-center text-white font-medium transition hover:bg-rose-700 sm:col-span-2">
                  Super Admin Dashboard
                </Link>
              )}
            </>
          )}
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-2xl font-semibold">How to use</h2>
          <ol className="mt-4 space-y-3 text-slate-700 list-decimal list-inside">
            <li>Run the backend on port <strong>3001</strong>.</li>
            <li>Open the frontend on port <strong>3000</strong>.</li>
            <li>Login with <strong>admin / password</strong>.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
