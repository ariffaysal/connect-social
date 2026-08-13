import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken } from '../lib/auth';

type AdminUser = {
  userId: number;
  username: string;
  role: string;
  fullName?: string;
  email?: string;
  jobTitle?: string;
  departmentId?: number;
  departmentName?: string;
  departmentColor?: string;
  isActive: boolean;
  postCount?: number;
  commentCount?: number;
};

type Department = { id: number; name: string; description?: string; color: string };

const ROLES = ['SuperAdmin', 'Moderator', 'RegularUser', 'Guest'];
const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: 'bg-rose-100 text-rose-800',
  Moderator: 'bg-amber-100 text-amber-800',
  RegularUser: 'bg-emerald-100 text-emerald-800',
  Guest: 'bg-slate-100 text-slate-800',
};

export default function AdminPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [tab, setTab] = useState<'users' | 'departments'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'RegularUser',
    fullName: '',
    email: '',
    departmentId: '',
  });
  const [newDept, setNewDept] = useState({ name: '', description: '', color: '#6366f1' });
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingDeptForm, setEditingDeptForm] = useState({ name: '', description: '', color: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    if (profile && profile.role !== 'SuperAdmin') {
      router.push('/feed');
      return;
    }
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const load = async () => {
    try {
      const [u, d] = await Promise.all([
        apiFetch<AdminUser[]>('/users'),
        apiFetch<Department[]>('/departments'),
      ]);
      setUsers(u);
      setDepartments(d);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const flash = (text: string, isError = false) => {
    setMessage(text);
    if (isError) setError(text);
    else setError('');
    setTimeout(() => {
      setMessage('');
      setError('');
    }, 4000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
      };
      if (newUser.fullName) payload.fullName = newUser.fullName;
      if (newUser.email) payload.email = newUser.email;
      if (newUser.departmentId !== '') payload.departmentId = Number(newUser.departmentId);
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
      setNewUser({ username: '', password: '', role: 'RegularUser', fullName: '', email: '', departmentId: '' });
      flash('User created!');
      await load();
    } catch (err: any) {
      flash(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (userId: number, patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(patch) });
      await load();
    } catch (err: any) {
      flash(err.message, true);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/departments', { method: 'POST', body: JSON.stringify(newDept) });
      setNewDept({ name: '', description: '', color: '#6366f1' });
      flash('Department created!');
      await load();
    } catch (err: any) {
      flash(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  const saveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setSaving(true);
    try {
      await apiFetch(`/departments/${editingDept.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editingDeptForm),
      });
      setEditingDept(null);
      flash('Department updated!');
      await load();
    } catch (err: any) {
      flash(err.message, true);
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = async (dept: Department) => {
    if (!window.confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await apiFetch(`/departments/${dept.id}`, { method: 'DELETE' });
      flash('Department deleted');
      await load();
    } catch (err: any) {
      flash(err.message, true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNav profile={profile} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Admin</h1>
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm">
            {(['users', 'departments'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition ${
                  tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        )}
        {message && !error && (
          <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>
        )}

        {tab === 'users' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Create user</h2>
                <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
                  <input
                    value={newUser.username}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Username *"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <input
                    value={newUser.password}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                    type="password"
                    placeholder="Password *"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <input
                    value={newUser.fullName}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <input
                    value={newUser.email}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <select
                    value={newUser.departmentId}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, departmentId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Creating…' : 'Create user'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Users ({users.length})</h2>
                <table className="mt-4 w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Role</th>
                      <th className="px-2 py-2">Department</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Stats</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.userId}>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={u.fullName || u.username} size="sm" />
                            <div>
                              <p className="font-medium text-slate-900">
                                {u.fullName || u.username}
                              </p>
                              <p className="text-xs text-slate-400">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => updateUser(u.userId, { role: e.target.value })}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3">
                          <select
                            value={u.departmentId ?? ''}
                            onChange={(e) =>
                              updateUser(u.userId, {
                                departmentId: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                          >
                            <option value="">—</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => updateUser(u.userId, { isActive: !u.isActive })}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              u.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-2 py-3 text-xs text-slate-500">
                          {u.postCount ?? 0} posts · {u.commentCount ?? 0} comments
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'departments' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">
                  {editingDept ? `Edit ${editingDept.name}` : 'Create department'}
                </h2>
                <form
                  onSubmit={editingDept ? saveDept : handleCreateDept}
                  className="mt-4 space-y-3"
                >
                  <input
                    value={editingDept ? editingDeptForm.name : newDept.name}
                    onChange={(e) =>
                      editingDept
                        ? setEditingDeptForm((prev) => ({ ...prev, name: e.target.value }))
                        : setNewDept((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Department name *"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <input
                    value={editingDept ? editingDeptForm.description : newDept.description}
                    onChange={(e) =>
                      editingDept
                        ? setEditingDeptForm((prev) => ({ ...prev, description: e.target.value }))
                        : setNewDept((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Description"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <input
                    type="color"
                    value={editingDept ? editingDeptForm.color : newDept.color}
                    onChange={(e) =>
                      editingDept
                        ? setEditingDeptForm((prev) => ({ ...prev, color: e.target.value }))
                        : setNewDept((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="h-10 w-full cursor-pointer rounded-xl border border-slate-200"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {editingDept ? 'Save' : 'Create'}
                    </button>
                    {editingDept && (
                      <button
                        type="button"
                        onClick={() => setEditingDept(null)}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Departments ({departments.length})</h2>
                <div className="mt-4 space-y-3">
                  {departments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                        style={{ backgroundColor: `${d.color}22` }}
                      >
                        🏢
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{d.name}</p>
                        {d.description && (
                          <p className="truncate text-xs text-slate-500">{d.description}</p>
                        )}
                      </div>
                      <span
                        className="h-5 w-5 rounded-full"
                        style={{ backgroundColor: d.color }}
                        title={d.color}
                      />
                      <button
                        onClick={() => {
                          setEditingDept(d);
                          setEditingDeptForm({
                            name: d.name,
                            description: d.description ?? '',
                            color: d.color,
                          });
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteDept(d)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
