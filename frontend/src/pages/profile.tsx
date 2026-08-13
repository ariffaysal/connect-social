import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import ProfileView from '../components/ProfileView';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken, Profile } from '../lib/auth';

type Department = { id: number; name: string; description?: string; color: string };

export default function MyProfilePage() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    jobTitle: '',
    bio: '',
    avatarUrl: '',
    departmentId: '',
  });

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    apiFetch<Department[]>('/departments').then(setDepartments).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName ?? '',
        email: profile.email ?? '',
        jobTitle: profile.jobTitle ?? '',
        bio: profile.bio ?? '',
        avatarUrl: profile.avatarUrl ?? '',
        departmentId: profile.departmentId ? String(profile.departmentId) : '',
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email || undefined,
        jobTitle: form.jobTitle,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
      };
      if (form.departmentId !== '') payload.departmentId = Number(form.departmentId);
      const updated = await apiFetch<Profile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setProfile(updated);
      setEditing(false);
      setMessage('Profile updated!');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = (field: keyof typeof form, label: string, multiline = false) => (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          value={form[field] as string}
          onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
          rows={4}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      ) : (
        <input
          value={form[field] as string}
          onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
      )}
    </label>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNav profile={profile} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        {message && (
          <p
            className={`mb-4 rounded-xl p-3 text-sm ${
              message === 'Profile updated!'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {message}
          </p>
        )}

        {profile && <ProfileView profile={profile} />}

        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <h2 className="text-lg font-semibold">Edit Profile</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {input('fullName', 'Full name')}
                {input('email', 'Email')}
                {input('jobTitle', 'Job title')}
                {input('avatarUrl', 'Avatar URL')}
              </div>
              {input('bio', 'Bio', true)}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Department</span>
                <select
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, departmentId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">No department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Update your bio, avatar, job title, and department.
              </p>
              <button
                onClick={() => setEditing(true)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
