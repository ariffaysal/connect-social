import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import TopNav from '../components/TopNav';
import Avatar from '../components/Avatar';
import ReactionBar, { ReactionSummary } from '../components/ReactionBar';
import useProfile from '../hooks/useProfile';
import { apiFetch, canPost, getToken, isModOrAdmin } from '../lib/auth';
import { uploadImage } from '../lib/upload';
import { timeAgo } from '../lib/format';

type Department = { id: number; name: string; description?: string; color: string };

type FeedComment = {
  id: number;
  content: string;
  postId: number;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
  reactions: ReactionSummary;
};

type FeedPost = {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  departmentId?: number;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
  commentsCount: number;
  reactions: ReactionSummary;
  comments?: FeedComment[];
};

type TopUser = {
  userId: number;
  username: string;
  fullName: string;
  avatarUrl?: string;
  departmentId?: number;
  posts: number;
  comments: number;
  reactions: number;
  engagement: number;
};

const REACTIONS: ('like' | 'love' | 'wow')[] = ['like', 'love', 'wow'];

export default function FeedPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [filter, setFilter] = useState<number | 'all' | 'company'>('all');
  const [error, setError] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [deptId, setDeptId] = useState<number | ''>('');
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [dropActive, setDropActive] = useState(false);

  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [reportTarget, setReportTarget] = useState<{
    type: 'post' | 'comment';
    id: number;
  } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState('');

  // Post edit state
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editDeptId, setEditDeptId] = useState<number | ''>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDepartments = useCallback(async () => {
    try {
      setDepartments(await apiFetch<Department[]>('/departments'));
    } catch {
      setDepartments([]);
    }
  }, []);

  const buildPostsUrl = (next: number | 'all' | 'company', offset: number = 0) => {
    const params = new URLSearchParams();
    params.set('limit', '30');
    params.set('offset', String(offset));
    if (next === 'company') {
      params.set('scope', 'company');
    } else if (next !== 'all') {
      params.set('departmentId', String(next));
    }
    return `/posts?${params.toString()}`;
  };

  const loadPosts = useCallback(async (next: number | 'all' | 'company', resetOffset = true) => {
    const currentOffset = resetOffset ? 0 : offset;
    if (resetOffset) {
      setLoadingPosts(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await apiFetch<FeedPost[]>(buildPostsUrl(next, currentOffset));
      // Data from API is now { posts, total, hasMore } but we need to handle both
      // old array response and new paginated response for backwards compatibility
      const postsData = Array.isArray(data) ? data : (data as any).posts || data;
      const hasMoreData = Array.isArray(data) ? data.length === 30 : !!(data as any).hasMore;
      
      if (resetOffset) {
        setPosts(postsData);
        setHasMore(hasMoreData);
      } else {
        setPosts((prev) => [...prev, ...postsData]);
        setHasMore(hasMoreData);
        setOffset((prev) => prev + (Array.isArray(data) ? data.length : (data as any).posts?.length || 0));
      }
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (resetOffset) {
        setLoadingPosts(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    try {
      setTopUsers(await apiFetch<TopUser[]>('/monitoring/top-users?limit=6'));
    } catch {
      setTopUsers([]);
    }
  }, []);

  // Reads are private: anonymous visitors have no token, so the backend
  // rejects every feed request. Send them to the login page instead, and
  // bring them back here after signing in (?next=).
  useEffect(() => {
    if (!getToken()) {
      router.push('/login?next=/feed');
      return;
    }
    // Only load data if we have a token
    loadDepartments();
    loadPosts(filter);
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, getToken()]);

  useEffect(() => {
    if (!router.query.post || posts.length === 0) return;
    const id = `post-${router.query.post}`;
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(id)?.classList.add('ring-2', 'ring-indigo-400');
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, router.query.post]);

  const handleFilter = (next: number | 'all' | 'company') => {
    setFilter(next);
    loadPosts(next);
  };

  // Load more posts when scrolling near bottom
  const loadMorePosts = useCallback(async () => {
    if (!hasMore || loadingMore || loadingPosts) return;
    await loadPosts(filter, false);
  }, [filter, hasMore, loadingMore, loadingPosts]);

  const loadComments = async (postId: number) => {
    const comments = await apiFetch<FeedComment[]>(`/posts/${postId}/comments`);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments } : p)),
    );
  };

  const toggleComments = async (postId: number) => {
    const isOpen = expanded[postId];
    setExpanded((prev) => ({ ...prev, [postId]: !isOpen }));
    if (!isOpen) {
      await loadComments(postId);
    }
  };

  const handleImageFile = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    try {
      setImageUrl(await uploadImage(file));
    } catch (err: any) {
      setUploadMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        content,
      };
      if (imageUrl) payload.imageUrl = imageUrl;
      if (deptId !== '') payload.departmentId = deptId;
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
      setTitle('');
      setContent('');
      setImageUrl('');
      setDeptId('');
      setUploadMsg('');
      await loadPosts(filter);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleReactPost = async (postId: number, type: 'like' | 'love' | 'wow') => {
    try {
      await apiFetch(`/posts/${postId}/react`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      const refreshed = await apiFetch<any>(buildPostsUrl(filter));
      const postsData = Array.isArray(refreshed) ? refreshed : (refreshed as any).posts || refreshed;
      setPosts(postsData);
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
      const postsCopy = [...posts];
      for (let i = 0; i < postsCopy.length; i++) {
        if (postsCopy[i].comments) {
          const idx = postsCopy[i].comments!.findIndex((c) => c.id === commentId);
          if (idx >= 0) {
            const updated = await apiFetch<ReactionSummary>(
              `/comments/${commentId}/reactions`,
            );
            postsCopy[i].comments![idx] = {
              ...postsCopy[i].comments![idx],
              reactions: updated,
            };
          }
        }
      }
      setPosts(postsCopy);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleComment = async (postId: number) => {
    const text = commentDrafts[postId];
    if (!text || !text.trim()) return;
    try {
      await apiFetch(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      await loadComments(postId);
      await loadPosts(filter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      await loadPosts(filter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteComment = async (commentId: number, postId: number) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await apiFetch(`/comments/${commentId}`, { method: 'DELETE' });
      await loadComments(postId);
      await loadPosts(filter);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget || !reportReason.trim()) return;
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          reason: reportReason,
        }),
      });
      setReportTarget(null);
      setReportReason('');
      setReportError('');
    } catch (err: any) {
      setReportError(err.message);
    }
  };

  // Comment edit state
  const [editingComment, setEditingComment] = useState<{
    comment: FeedComment;
    postId: number;
  } | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);

  const handleEditComment = (comment: FeedComment, postId: number) => {
    setEditingComment({ comment, postId });
    setEditCommentText(comment.content);
  };

  const handleSaveCommentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComment || !editCommentText.trim()) return;
    setSavingCommentEdit(true);
    try {
      await apiFetch(`/comments/${editingComment.comment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editCommentText }),
      });
      setEditingComment(null);
      await loadComments(editingComment.postId);
      await loadPosts(filter);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const canDelete = (ownerId: number) =>
    profile && (ownerId === profile.userId || isModOrAdmin(profile.role));

  const handleEditPost = (post: FeedPost) => {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditImageUrl(post.imageUrl || '');
    setEditDeptId(post.departmentId ?? '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, unknown> = {
        title: editTitle,
        content: editContent,
      };
      if (editImageUrl) payload.imageUrl = editImageUrl;
      if (editDeptId !== '') payload.departmentId = editDeptId;
      else if (editImageUrl === '') payload.imageUrl = undefined;
      
      await apiFetch(`/posts/${editingPost.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditingPost(null);
      await loadPosts(filter);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deptById = (id?: number) =>
    departments.find((d) => d.id === id);
  const globalAccess =
    !!profile && (isModOrAdmin(profile.role) || !!profile.allDepartmentsAccess);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Head>
        <title>Feed — ConnectSocial</title>
        <meta
          name="description"
          content="Company feed — share updates, comment and react with your colleagues."
        />
      </Head>
      <h1 className="sr-only">Feed</h1>
      <TopNav profile={profile} />

      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr_260px]">
          {/* Left sidebar: departments */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Groups
              </h2>
              <button
                onClick={() => handleFilter('company')}
                className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  filter === 'company' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-base">
                  🌐
                </span>
                All Company
              </button>
              {globalAccess && (
                <button
                  onClick={() => handleFilter('all')}
                  className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    filter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-base">
                    🗂️
                  </span>
                  All Posts
                </button>
              )}
              {departments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleFilter(d.id)}
                  className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    filter === d.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                    style={{ backgroundColor: `${d.color}22` }}
                  >
                    🏢
                  </span>
                  {d.name}
                </button>
              ))}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <Link
                  href="/profile"
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  👤 My Profile
                </Link>
              </div>
            </div>
          </aside>

          {/* Center: composer + feed */}
          <main className="space-y-5">
            {/* Infinite scroll trigger */}
            {hasMore && (
              <div
                onScroll={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 200) {
                    loadMorePosts();
                  }
                }}
                className="h-10 overflow-auto"
              />
            )}
            {profile && canPost(profile.role) && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Avatar
                    name={profile.fullName || profile.username}
                    avatarUrl={profile.avatarUrl}
                  />
                  <form onSubmit={handlePublish} className="flex-1 space-y-3">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="What's on your mind?"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Post title (required)"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {imageUrl ? (
                        <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <img
                            src={imageUrl}
                            alt="Attachment preview"
                            className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                            Image attached
                          </span>
                          <button
                            type="button"
                            onClick={() => setImageUrl('')}
                            disabled={uploading}
                            className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-300 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropActive(true);
                          }}
                          onDragLeave={() => setDropActive(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropActive(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleImageFile(file);
                          }}
                          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs transition ${
                            dropActive
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                        >
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageFile(file);
                              e.target.value = '';
                            }}
                          />
                          {uploading ? (
                            <span className="font-medium text-indigo-600">
                              Uploading…
                            </span>
                          ) : (
                            <>
                              <span className="text-lg leading-none">📷</span>
                              <span className="font-medium">
                                Drag & drop an image or click to upload
                              </span>
                              <span>PNG, JPG, GIF or WebP · up to 5 MB</span>
                            </>
                          )}
                        </label>
                      )}
                      <select
                        value={deptId}
                        onChange={(e) =>
                          setDeptId(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        title="Who can see this post"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                      >
                        <option value="">🌐 All Company</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={
                          publishing || uploading || !title.trim() || !content.trim()
                        }
                        className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {publishing ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                    {uploadMsg && (
                      <p className="text-xs font-medium text-rose-600">{uploadMsg}</p>
                    )}
                  </form>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {loadingPosts ? (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  Loading posts…
                </p>
              ) : posts.length === 0 ? (
                <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No posts yet. Be the first to share something!
                </p>
              ) : (
                posts.map((post) => {
                const postDept = deptById(post.departmentId);
                const isExpanded = expanded[post.id];
                return (
                  <article
                    key={post.id}
                    id={`post-${post.id}`}
                    className="rounded-2xl bg-white p-5 shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${post.ownerId}`}>
                          <Avatar name={post.ownerUsername} />
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/profile/${post.ownerId}`}
                              className="text-sm font-semibold text-slate-900 hover:underline"
                            >
                              {post.ownerUsername}
                            </Link>
                            {postDept ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  color: postDept.color,
                                  backgroundColor: `${postDept.color}1a`,
                                }}
                              >
                                {postDept.name}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                🌐 All Company
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">
                            {timeAgo(post.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setReportTarget({ type: 'post', id: post.id })}
                          className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          Report
                        </button>
                        {canDelete(post.ownerId) && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="rounded-full px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        )}
                        {profile && post.ownerId === profile.userId && (
                          <button
                            onClick={() => handleEditPost(post)}
                            className="rounded-full px-3 py-1.5 text-xs font-medium text-indigo-500 transition hover:bg-indigo-50"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      {post.title}
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {post.content}
                    </p>
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="mt-3 max-h-96 w-full rounded-2xl border border-slate-100 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <ReactionBar
                        reactions={post.reactions}
                        onReact={(type) => handleReactPost(post.id, type)}
                        disabled={!profile || !canPost(profile.role)}
                      />
                      <button
                        onClick={() => toggleComments(post.id)}
                        className="text-sm font-medium text-slate-500 transition hover:text-indigo-600"
                      >
                        💬 {post.commentsCount} comment{post.commentsCount === 1 ? '' : 's'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        {(post.comments ?? []).length === 0 && (
                          <p className="text-sm text-slate-400">
                            No comments yet — start the conversation.
                          </p>
                        )}
                        {(post.comments ?? []).map((comment) => (
                          <div key={comment.id} className="flex gap-2">
                            <Link href={`/profile/${comment.ownerId}`}>
                              <Avatar name={comment.ownerUsername} size="sm" />
                            </Link>
                            <div className="flex-1 rounded-2xl bg-slate-100 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900">
                                  {comment.ownerUsername}
                                  <span className="ml-2 font-normal text-slate-400">
                                    {timeAgo(comment.createdAt)}
                                  </span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      setReportTarget({ type: 'comment', id: comment.id })
                                    }
                                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
                                  >
                                    Report
                                  </button>
                                  {canDelete(comment.ownerId) && (
                                    <>
                                      <button
                                        onClick={() =>
                                          handleDeleteComment(comment.id, post.id)
                                        }
                                        className="text-[11px] font-medium text-rose-500 hover:text-rose-700"
                                      >
                                        Delete
                                      </button>
                                      {profile && comment.ownerId === profile.userId && (
                                        <button
                                          onClick={() =>
                                            handleEditComment(comment, post.id)
                                          }
                                          className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700"
                                        >
                                          Edit
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <p className="mt-1 text-sm text-slate-700">{comment.content}</p>
                              <ReactionBar
                                compact
                                reactions={comment.reactions}
                                onReact={(type) => handleReactComment(comment.id, type)}
                                disabled={!profile || !canPost(profile.role)}
                              />
                            </div>
                          </div>
                        ))}
                        {profile && canPost(profile.role) ? (
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={profile.fullName || profile.username}
                              avatarUrl={profile.avatarUrl}
                              size="sm"
                            />
                            <input
                              value={commentDrafts[post.id] || ''}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleComment(post.id);
                              }}
                              placeholder="Write a comment…"
                              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                            <button
                              onClick={() => handleComment(post.id)}
                              className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
                            >
                              Send
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              }))}
            </div>
          </main>

          {/* Right sidebar: leaderboard */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              {topUsers.length > 0 && (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Top Contributors
                  </h2>
                  <div className="mt-3 space-y-3">
                    {topUsers.map((u, index) => (
                      <Link
                        key={u.userId}
                        href={`/profile/${u.userId}`}
                        className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-slate-50"
                      >
                        <span className="w-4 text-sm font-bold text-slate-300">
                          {index + 1}
                        </span>
                        <Avatar name={u.fullName || u.username} avatarUrl={u.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {u.fullName || u.username}
                          </p>
                          <p className="text-xs text-slate-400">
                            {u.posts} posts · {u.comments} comments
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-500">
                          {u.engagement}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">
                <p className="font-medium text-slate-700">Welcome to ConnectSocial 👋</p>
                <p className="mt-1 text-xs">
                  Share company updates, react to colleagues' posts, and keep everyone in the loop.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Report modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report {reportTarget.type}</h2>
              <button
                onClick={() => setReportTarget(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <form onSubmit={submitReport} className="mt-4 space-y-3">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={3}
                placeholder="Why are you reporting this?"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {reportError && <p className="text-sm text-rose-600">{reportError}</p>}
              <button
                type="submit"
                disabled={!reportReason.trim()}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                Submit Report
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit post modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Post</h2>
              <button
                onClick={() => setEditingPost(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  required
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Image URL (optional)</label>
                <input
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                {editImageUrl && (
                  <img
                    src={editImageUrl}
                    alt="Preview"
                    className="mt-2 max-h-48 rounded-lg border border-slate-200 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Department</label>
                <select
                  value={editDeptId}
                  onChange={(e) =>
                    setEditDeptId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="">🌐 All Company</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit comment modal */}
      {editingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Comment</h2>
              <button
                onClick={() => setEditingComment(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCommentEdit} className="mt-4 space-y-3">
              <textarea
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                required
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              {reportError && <p className="text-sm text-rose-600">{reportError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingCommentEdit || !editCommentText.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingCommentEdit ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingComment(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
