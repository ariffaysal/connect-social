import Head from 'next/head';
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

type PostsResponse = {
  posts: FeedPost[];
  total: number;
  hasMore: boolean;
};

const PROFILE_POST_PAGE_SIZE = 30;

export default function PublicProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const { profile: me } = useProfile();
  const [target, setTarget] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsOffset, setPostsOffset] = useState(0);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const userId = Number(id);
    if (!Number.isFinite(userId)) return;

    let cancelled = false;
    setPosts([]);
    setPostsOffset(0);
    setPostsHasMore(false);
    setPostsLoading(true);

    apiFetch<Profile>(`/users/${userId}`)
      .then((profile) => {
        if (!cancelled) setTarget(profile);
      })
      .catch((err) => setError(err.message));

    apiFetch<PostsResponse>(
      `/posts/user/${userId}?limit=${PROFILE_POST_PAGE_SIZE}&offset=0`,
    )
      .then((response) => {
        if (cancelled) return;
        setPosts(response.posts);
        setPostsOffset(response.posts.length);
        setPostsHasMore(response.hasMore);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleLoadMore = async () => {
    const userId = Number(id);
    if (
      !Number.isFinite(userId) ||
      postsLoading ||
      postsLoadingMore ||
      !postsHasMore
    ) {
      return;
    }

    setPostsLoadingMore(true);
    try {
      const response = await apiFetch<PostsResponse>(
        `/posts/user/${userId}?limit=${PROFILE_POST_PAGE_SIZE}&offset=${postsOffset}`,
      );
      setPosts((previous) => [
        ...previous,
        ...response.posts,
      ]);
      setPostsOffset((previous) => previous + response.posts.length);
      setPostsHasMore(response.hasMore);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPostsLoadingMore(false);
    }
  };

  const handleReactPost = async (postId: number, type: 'like' | 'love' | 'wow') => {
    try {
      await apiFetch(`/posts/${postId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      const refreshed = await apiFetch<ReactionSummary>(
        `/posts/${postId}/reactions`,
      );
      setPosts((previous) =>
        previous.map((post) =>
          post.id === postId ? { ...post, reactions: refreshed } : post,
        ),
      );
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

  const pageTitle = target
    ? `${target.fullName || target.username} — ConnectSocial`
    : 'Profile — ConnectSocial';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content="ConnectSocial member profile." />
      </Head>
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

        {!target && !error && (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Loading profile…
          </p>
        )}

        {target && !error && (
          <>
            <ProfileView profile={target} />
            <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-900">
              Posts by {target.fullName || target.username}
            </h2>
            <div className="space-y-4">
              {postsLoading && (
                <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                  Loading posts…
                </p>
              )}
              {!postsLoading && posts.length === 0 && (
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
              {!postsLoading && postsHasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={postsLoadingMore}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {postsLoadingMore ? 'Loading more posts…' : 'Load more posts'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
