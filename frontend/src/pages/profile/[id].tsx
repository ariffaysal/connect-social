import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import TopNav from '../../components/TopNav';
import ProfileView from '../../components/ProfileView';
import Avatar from '../../components/Avatar';
import useProfile from '../../hooks/useProfile';
import { apiFetch, canPost, isModOrAdmin, Profile } from '../../lib/auth';
import { timeAgo } from '../../lib/format';
import ReactionBar, { ReactionSummary } from '../../components/ReactionBar';

type FeedPost = {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
  commentsCount: number;
  reactions: ReactionSummary;
};

export default function PublicProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile: me } = useProfile();
  const [target, setTarget] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const userId = Number(id);
    if (!Number.isFinite(userId)) return;

    apiFetch<Profile>(`/users/${userId}`)
      .then(setTarget)
      .catch((err) => setError(err.message));

    apiFetch<FeedPost[]>(`/posts`).then((all) =>
      setPosts(all.filter((p) => p.ownerId === userId)),
    ).catch(() => {});
  }, [id]);

  const handleReactPost = async (postId: number, type: 'like' | 'love' | 'wow') => {
    try {
      await apiFetch(`/posts/${postId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      const refreshed = await apiFetch<FeedPost[]>('/posts');
      setPosts(refreshed.filter((p) => p.ownerId === Number(id)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <TopNav profile={me} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        {error && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-slate-600">{error}</p>
            <Link href="/feed" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
              ← Back to feed
            </Link>
          </div>
        )}

        {target && !error && (
          <>
            <ProfileView profile={target} />
            <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-900">
              Posts by {target.fullName || target.username}
            </h2>
            <div className="space-y-4">
              {posts.length === 0 && (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                  No posts yet.
                </p>
              )}
              {posts.map((post) => (
                <article key={post.id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={post.ownerUsername}
                        avatarUrl={target.avatarUrl}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {post.ownerUsername}
                        </p>
                        <span className="text-xs text-slate-400">
                          {timeAgo(post.createdAt)}
                        </span>
                      </div>
                    </div>
                    {me && (me.userId === post.ownerId || isModOrAdmin(me.role)) && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-xs font-medium text-rose-500 hover:text-rose-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{post.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {post.content}
                  </p>
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="mt-3 max-h-72 w-full rounded-xl border border-slate-100 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <ReactionBar
                      compact
                      reactions={post.reactions}
                      onReact={(type) => handleReactPost(post.id, type)}
                      disabled={!me || !canPost(me.role)}
                    />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
