import { useEffect, useState } from 'react';
import Link from 'next/link';

type User = {
  id: number;
  username: string;
  role: string;
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [role, setRole] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('RegularUser');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('rbms_token') : null;
    if (!token) {
      setError('Please login first.');
      return;
    }

    // First fetch profile to verify role
    fetch('http://localhost:3001/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        const data = await res.json();
        setRole(data.role);
        if (data.role !== 'SuperAdmin') {
          throw new Error('Access denied. Super Admin only.');
        }
        return fetch('http://localhost:3001/users', {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then(async (res) => {
        if (!res) return;
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
      })
      .then((data) => {
        if (data) setUsers(data);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const token = localStorage.getItem('rbms_token');
    try {
      const res = await fetch('http://localhost:3001/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newUserRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create user');
      }

      const createdUser = await res.json();
      setUsers((prev) => [...prev, createdUser]);
      setSuccess('User created successfully!');
      setNewUsername('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (error && error.includes('Access denied')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-900">
        <h1 className="text-3xl font-bold text-rose-600">Access Denied</h1>
        <p className="mt-4">{error}</p>
        <Link href="/" className="mt-6 text-indigo-600 hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Super Admin Dashboard</h1>
          <div className="flex gap-4">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition">
              Home
            </Link>
            <Link href="/posts" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition">
              View Posts
            </Link>
          </div>
        </div>

        {error && <p className="mb-6 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
        {success && <p className="mb-6 rounded-xl bg-emerald-50 p-4 text-emerald-700">{success}</p>}

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-xl font-semibold mb-4">Create New User</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="SuperAdmin">Super Admin</option>
                    <option value="Moderator">Moderator</option>
                    <option value="RegularUser">Regular User</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white font-medium hover:bg-indigo-700 transition"
                >
                  Create User
                </button>
              </form>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/50">
              <h2 className="text-xl font-semibold mb-4">Manage Accounts</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Username</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900">{user.id}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">{user.username}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            user.role === 'SuperAdmin' ? 'bg-rose-100 text-rose-800' :
                            user.role === 'Moderator' ? 'bg-amber-100 text-amber-800' :
                            user.role === 'RegularUser' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
