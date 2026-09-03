import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import ProfileView from '../components/ProfileView';
import Avatar from '../components/Avatar';
import useProfile from '../hooks/useProfile';
import { apiFetch, getToken, Profile } from '../lib/auth';
import { uploadImage } from '../lib/upload';

export default function MyProfilePage() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    jobTitle: '',
    bio: '',
    avatarUrl: '',
  });

  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=/profile');
      return;
    }
  }, [router]);

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName ?? '',
        email: profile.email ?? '',
        jobTitle: profile.jobTitle ?? '',
        bio: profile.bio ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      });
    }
  }, [profile]);

  const handleAvatarFile = async (file?: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarMsg('');
    try {
      const url = await uploadImage(file);
      setForm((prev) => ({ ...prev, avatarUrl: url }));
    } catch (err: any) {
      setAvatarMsg(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

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
      <Head>
        <title>My Profile — ConnectSocial</title>
        <meta name="description" content="Your ConnectSocial profile." />
      </Head>
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
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Profile picture
                  </span>
                  <div className="mt-1 flex items-center gap-3">
                    <Avatar
                      name={form.fullName || '?'}
                      avatarUrl={form.avatarUrl || undefined}
                      size="lg"
                    />
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleAvatarFile(e.dataTransfer.files?.[0]);
                      }}
                      className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50/50"
                    >
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          handleAvatarFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      {uploadingAvatar ? (
                        <span className="font-medium text-indigo-600">
                          Uploading…
                        </span>
                      ) : form.avatarUrl ? (
                        <span className="font-medium">
                          Click to replace picture
                        </span>
                      ) : (
                        <span className="font-medium">
                          Drag & drop or click to upload a picture
                        </span>
                      )}
                    </label>
                  </div>
                  {avatarMsg && (
                    <p className="mt-1 text-xs font-medium text-rose-600">
                      {avatarMsg}
                    </p>
                  )}
                </label>
              </div>
              {input('bio', 'Bio', true)}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Department</span>
                <p className="mt-1 w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                  {profile?.allDepartmentsAccess
                    ? '🌐 All Departments'
                    : profile?.departmentName || 'No department'}
                  <span className="ml-1 text-xs text-slate-400">
                    · managed by admin
                  </span>
                </p>
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
