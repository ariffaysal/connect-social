import { useEffect, useState } from 'react';
import Link from 'next/link';

type Profile = {
  userId: number;
  username: string;
  role: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rbms_token') : null;
    if (!token) {
      setError('Please login first.');
      return;
    }

    fetch('http://localhost:3001/auth/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to fetch profile');
        }
        return res.json();
      })
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-10 shadow-xl shadow-slate-200/70">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Profile</h1>
          <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900">
            Login page
          </Link>
        </div>

        {error ? (
          <p className="mt-6 rounded-2xl bg-rose-50 p-4 text-rose-700">{error}</p>
        ) : profile ? (
          <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p>
              <span className="font-semibold">User ID:</span> {profile.userId}
            </p>
            <p>
              <span className="font-semibold">Username:</span> {profile.username}
            </p>
            <p>
              <span className="font-semibold">Role:</span> {profile.role}
            </p>
          </div>
        ) : (
          <p className="mt-6 text-slate-600">Loading profile…</p>
        )}
      </div>
    </main>
  );
}
