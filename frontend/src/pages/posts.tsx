import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '../lib/api';

type Comment = {
  id: number;
  content: string;
  postId: number;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
};

type Post = {
  id: number;
  title: string;
  content: string;
  ownerId: number;
  ownerUsername: string;
  createdAt: string;
  comments?: Comment[];
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');
  const [role, setRole] = useState('Guest');
  const [userId, setUserId] = useState(0);

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [commentContent, setCommentContent] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('connectsocial_token');
      if (token) {
        const profileRes = await fetch(`${API_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setRole(profile.role);
          setUserId(profile.userId);
        }
      }

      const postsRes = await fetch(`${API_URL}/posts`);
      if (!postsRes.ok) throw new Error('Failed to fetch posts');
      const postsData = await postsRes.json();

      // Fetch comments for each post
      const postsWithComments = await Promise.all(
        postsData.map(async (post: Post) => {
          const cRes = await fetch(`${API_URL}/posts/${post.id}/comments`);
          const commentsData = cRes.ok ? await cRes.json() : [];
          return { ...post, comments: commentsData };
        })
      );

      setPosts(postsWithComments);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('connectsocial_token');
    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle, content: newContent }),
      });
      if (!res.ok) throw new Error('Failed to create post');
      setNewTitle('');
      setNewContent('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePost = async (id: number) => {
    const token = localStorage.getItem('connectsocial_token');
    try {
      const res = await fetch(`${API_URL}/posts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete post');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateComment = async (postId: number) => {
    const token = localStorage.getItem('connectsocial_token');
    const content = commentContent[postId];
    if (!content) return;
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to create comment');
      setCommentContent((prev) => ({ ...prev, [postId]: '' }));
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    const token = localStorage.getItem('connectsocial_token');
    try {
      const res = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete comment');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const canCreatePost = ['SuperAdmin', 'Moderator', 'RegularUser'].includes(role);
  
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Posts</h1>
          <div className="flex gap-4">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition">
              Home
            </Link>
            {role === 'SuperAdmin' && (
              <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition">
                Admin Dashboard
              </Link>
            )}
          </div>
        </div>

        {error && <p className="mb-6 rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}

        {canCreatePost && (
          <div className="mb-10 rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/50">
            <h2 className="text-xl font-semibold mb-4">Create New Post</h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <input
                type="text"
                placeholder="Post Title"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
              <textarea
                placeholder="Post Content"
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="block w-full rounded-xl border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                rows={3}
              />
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-6 py-2 text-white font-medium hover:bg-indigo-700 transition"
              >
                Post
              </button>
            </form>
          </div>
        )}

        <div className="space-y-8">
          {posts.map((post) => {
            const canDeletePost = post.ownerId === userId || role === 'SuperAdmin' || role === 'Moderator';
            
            return (
              <div key={post.id} className="rounded-3xl bg-white p-6 shadow-md shadow-slate-200/50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold">{post.title}</h3>
                    <p className="text-sm text-slate-500 mb-4">by {post.ownerUsername} on {new Date(post.createdAt).toLocaleDateString()}</p>
                  </div>
                  {canDeletePost && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-rose-500 hover:text-rose-700 text-sm font-semibold transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-slate-700 mb-6 whitespace-pre-wrap">{post.content}</p>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="font-semibold text-lg mb-4">Comments</h4>
                  <div className="space-y-4 mb-4">
                    {post.comments?.map((comment) => {
                      const canDeleteComment = comment.ownerId === userId || post.ownerId === userId || role === 'SuperAdmin' || role === 'Moderator';
                      return (
                        <div key={comment.id} className="flex justify-between items-start bg-slate-50 p-4 rounded-2xl">
                          <div>
                            <span className="font-semibold text-sm">{comment.ownerUsername}: </span>
                            <span className="text-sm text-slate-700">{comment.content}</span>
                          </div>
                          {canDeleteComment && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-rose-500 hover:text-rose-700 text-xs font-semibold ml-4 transition"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {post.comments?.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
                  </div>

                  {canCreatePost && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={commentContent[post.id] || ''}
                        onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                        className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleCreateComment(post.id)}
                        className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-white font-medium hover:bg-slate-900 transition"
                      >
                        Comment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
