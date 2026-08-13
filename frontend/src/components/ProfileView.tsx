import Avatar from './Avatar';
import { Profile } from '../lib/auth';

export default function ProfileView({ profile }: { profile: Profile }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end gap-4">
          <div className="rounded-full ring-4 ring-white">
            <Avatar
              name={profile.fullName || profile.username}
              avatarUrl={profile.avatarUrl}
              size="xl"
            />
          </div>
          <div className="pb-1">
            <h1 className="text-xl font-bold text-slate-900">
              {profile.fullName || profile.username}
            </h1>
            <p className="text-sm text-slate-500">@{profile.username}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              profile.role === 'SuperAdmin'
                ? 'bg-rose-100 text-rose-800'
                : profile.role === 'Moderator'
                  ? 'bg-amber-100 text-amber-800'
                  : profile.role === 'RegularUser'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-800'
            }`}
          >
            {profile.role}
          </span>
          {profile.departmentName && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                color: profile.departmentColor,
                backgroundColor: `${profile.departmentColor}1a`,
              }}
            >
              {profile.departmentName}
            </span>
          )}
          {profile.jobTitle && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {profile.jobTitle}
            </span>
          )}
        </div>

        {profile.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {profile.bio}
          </p>
        )}
        {profile.email && (
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {profile.email}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{profile.postCount ?? 0}</p>
            <p className="text-xs font-medium text-slate-500">Posts</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{profile.commentCount ?? 0}</p>
            <p className="text-xs font-medium text-slate-500">Comments</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{profile.reactionCount ?? 0}</p>
            <p className="text-xs font-medium text-slate-500">Reactions</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{profile.receivedReactions ?? 0}</p>
            <p className="text-xs font-medium text-slate-500">Reactions received</p>
          </div>
        </div>
      </div>
    </div>
  );
}
