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

type ProfileTab = 'posts' | 'comments' | 'reactions';

type ActivityPost = {
  id: number;
  title: string;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
};

type ProfileComment = {
  id: number;
  content: string;
  postId: number;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
  post: ActivityPost | null;
  reactions: ReactionSummary;
};

type CommentsResponse = {
  comments: ProfileComment[];
  total: number;
  hasMore: boolean;
};

type ProfileReaction = {
  id: number;
  type: 'like' | 'love' | 'wow';
  postId?: number;
  commentId?: number;
  createdAt: string;
  targetType: 'post' | 'comment';
  post: ActivityPost | null;
  comment: {
    id: number;
    content: string;
    postId: number;
    ownerId: number;
    ownerUsername: string;
    createdAt: string;
  } | null;
};

type ReactionsResponse = {
  reactions: ProfileReaction[];
  total: number;
  hasMore: boolean;
};

const PROFILE_POST_PAGE_SIZE = 30;
const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
  posts: 'Posts',
  comments: 'Comments',
  reactions: 'Reactions',
};
const REACTION_EMOJI: Record<ProfileReaction['type'], string> = {
  like: '👍',
  love: '❤️',
  wow: '😮',
};

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
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [reactions, setReactions] = useState<ProfileReaction[]>([]);
  const [reactionsOffset, setReactionsOffset] = useState(0);
  const [reactionsHasMore, setReactionsHasMore] = useState(false);
  const [reactionsLoading, setReactionsLoading] = useState(false);
  const [reactionsLoadingMore, setReactionsLoadingMore] = useState(false);
  const [reactionsLoaded, setReactionsLoaded] = useState(false);
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
    setActiveTab('posts');
    setComments([]);
    setCommentsOffset(0);
    setCommentsHasMore(false);
    setCommentsLoaded(false);
    setReactions([]);
    setReactionsOffset(0);
    setReactionsHasMore(false);
    setReactionsLoaded(false);

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

  const loadCommentsPage = async (offset: number) => {
    const userId = Number(id);
    if (!Number.isFinite(userId)) return;
    if (offset === 0) setCommentsLoading(true);
    else setCommentsLoadingMore(true);

    try {
      const response = await apiFetch<CommentsResponse>(
        `/users/${userId}/comments?limit=${PROFILE_POST_PAGE_SIZE}&offset=${offset}`,
      );
      setComments((previous) =>
        offset === 0 ? response.comments : [...previous, ...response.comments],
      );
      setCommentsOffset(offset + response.comments.length);
      setCommentsHasMore(response.hasMore);
    } catch (err: any) {
      setError(err.message);
      if (offset === 0) setCommentsLoaded(false);
    } finally {
      if (offset === 0) setCommentsLoading(false);
      else setCommentsLoadingMore(false);
    }
  };

  const loadReactionsPage = async (offset: number) => {
    const userId = Number(id);
    if (!Number.isFinite(userId)) return;
    if (offset === 0) setReactionsLoading(true);
    else setReactionsLoadingMore(true);

    try {
      const response = await apiFetch<ReactionsResponse>(
        `/users/${userId}/reactions?limit=${PROFILE_POST_PAGE_SIZE}&offset=${offset}`,
      );
      setReactions((previous) =>
        offset === 0 ? response.reactions : [...previous, ...response.reactions],
      );
      setReactionsOffset(offset + response.reactions.length);
      setReactionsHasMore(response.hasMore);
    } catch (err: any) {
      setError(err.message);
      if (offset === 0) setReactionsLoaded(false);
    } finally {
      if (offset === 0) setReactionsLoading(false);
      else setReactionsLoadingMore(false);
    }
  };

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    if (tab === 'comments' && !commentsLoaded) {
      setCommentsLoaded(true);
      void loadCommentsPage(0);
    }
    if (tab === 'reactions' && !reactionsLoaded) {
      setReactionsLoaded(true);
      void loadReactionsPage(0);
    }
  };

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

  const handleReactComment = async (commentId: number, type: 'like' | 'love' | 'wow') => {
    try {
      await apiFetch(`/comments/${commentId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      const refreshed = await apiFetch<ReactionSummary>(
        `/comments/${commentId}/reactions`,
      );
      setComments((previous) =>
        previous.map((comment) =>
          comment.id === commentId ? { ...comment, reactions: refreshed } : comment,
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
            <div className="mt-6 flex overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist" aria-label="Profile activity">
              {(Object.keys(PROFILE_TAB_LABELS) as ProfileTab[]).map((tab) => {
                const count = tab === 'posts'
                  ? target.postCount
                  : tab === 'comments'
                    ? target.commentCount
                    : target.reactionCount;
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleTabChange(tab)}
                    className={`min-w-max flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                  >
                    {PROFILE_TAB_LABELS[tab]}
                    {typeof count === 'number' && (
                      <span className={`ml-1.5 ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab === 'posts' && (
              <>
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

            {activeTab === 'comments' && (
              <>
                <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-900">
                  Comments by {target.fullName || target.username}
                </h2>
                <div className="space-y-4">
                  {commentsLoading && (
                    <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                      Loading comments…
                    </p>
                  )}
                  {!commentsLoading && comments.length === 0 && (
                    <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                      No comments yet.
                    </p>
                  )}
                  {comments.map((comment) => (
                    <article key={comment.id} className="rounded-2xl bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={target.fullName || target.username}
                          avatarUrl={target.avatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {target.fullName || target.username}
                          </p>
                          <p className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</p>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {comment.content}
                      </p>
                      {comment.post && (
                        <p className="mt-3 text-xs text-slate-500">
                          Commented on{' '}
                          <Link
                            href={`/feed?post=${comment.post.id}`}
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            {comment.post.title}
                          </Link>
                        </p>
                      )}
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <ReactionBar
                          compact
                          reactions={comment.reactions}
                          onReact={(type) => handleReactComment(comment.id, type)}
                          disabled={!me || !canPost(me.role)}
                        />
                      </div>
                    </article>
                  ))}
                  {!commentsLoading && commentsHasMore && (
                    <button
                      type="button"
                      onClick={() => void loadCommentsPage(commentsOffset)}
                      disabled={commentsLoadingMore}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {commentsLoadingMore ? 'Loading more comments…' : 'Load more comments'}
                    </button>
                  )}
                </div>
              </>
            )}

            {activeTab === 'reactions' && (
              <>
                <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-900">
                  Reactions by {target.fullName || target.username}
                </h2>
                <div className="space-y-4">
                  {reactionsLoading && (
                    <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                      Loading reactions…
                    </p>
                  )}
                  {!reactionsLoading && reactions.length === 0 && (
                    <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                      No reactions yet.
                    </p>
                  )}
                  {reactions.map((reaction) => (
                    <article key={reaction.id} className="rounded-2xl bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-700">
                          <span className="mr-1 text-lg" aria-hidden="true">
                            {REACTION_EMOJI[reaction.type]}
                          </span>
                          Reacted <span className="font-semibold">{reaction.type}</span> to a{' '}
                          {reaction.targetType}
                        </p>
                        <span className="shrink-0 text-xs text-slate-400">
                          {timeAgo(reaction.createdAt)}
                        </span>
                      </div>
                      {reaction.post && (
                        <p className="mt-3 text-sm text-slate-600">
                          On{' '}
                          <Link
                            href={`/feed?post=${reaction.post.id}`}
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            {reaction.post.title}
                          </Link>
                        </p>
                      )}
                      {reaction.comment && (
                        <blockquote className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          “{reaction.comment.content}”
                        </blockquote>
                      )}
                    </article>
                  ))}
                  {!reactionsLoading && reactionsHasMore && (
                    <button
                      type="button"
                      onClick={() => void loadReactionsPage(reactionsOffset)}
                      disabled={reactionsLoadingMore}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {reactionsLoadingMore ? 'Loading more reactions…' : 'Load more reactions'}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
