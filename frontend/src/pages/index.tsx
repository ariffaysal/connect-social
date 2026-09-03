import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { API_URL } from '../lib/api';
import { getToken } from '../lib/auth';

const FEATURES = [
  {
    emoji: '📢',
    title: 'One feed, everyone informed',
    body: 'Post company announcements, project milestones and everyday wins. Share with the whole company or narrow it to a single department — the right people always see it.',
  },
  {
    emoji: '💬',
    title: 'Conversations that stay in context',
    body: 'Comment on a post and react with likes and loves. Every discussion stays attached to the update that started it, so nothing gets lost in a noisy chat stream.',
  },
  {
    emoji: '🔔',
    title: "You're never out of the loop",
    body: 'Get notified the moment a colleague posts or engages with your content. Catch up on what changed while you were away with a single glance at the feed.',
  },
  {
    emoji: '🛡️',
    title: 'Respectful and secure by default',
    body: 'Each role — guest, member, moderator, admin — sees and does exactly what it should. Reporting tools and moderators keep the feed constructive and welcoming.',
  },
];

const AUDIENCES = [
  'Leadership — share direction and announcements the whole team will actually see.',
  'Departments & remote teams — stay connected across offices, shifts and time zones.',
  'New joiners — get up to speed on what the company is working on, fast.',
];

const FAQS = [
  {
    question: 'Who can join ConnectSocial?',
    answer:
      'ConnectSocial is private to your organization — there is no open sign-up. Your company\u2019s administrator creates accounts, and everyone signs in with their own username and password. Visitors without an account cannot see any posts.',
  },
  {
    question: 'What can each role do?',
    answer:
      'Guests can read and follow along. Regular users can post, comment and react. Moderators can review reports and remove content that breaks the rules. Super admins manage users, departments and access, and can see platform activity.',
  },
  {
    question: 'Who can see what I post?',
    answer:
      'Posts published to \u201cAll Company\u201d are visible to every signed-in member. Posts published to a department are only visible to that department\u2019s members — plus moderators and admins, who help keep the feed safe.',
  },
  {
    question: 'Is my data private?',
    answer:
      'Yes. Every post, comment and reaction is behind a login on your company\u2019s own deployment — content never goes to a public feed, and department posts stay within their department.',
  },
  {
    question: 'How do reports work?',
    answer:
      'If a post or comment feels off, any member can report it in one click. The report lands in the moderation queue, where moderators and admins review it and resolve or dismiss it — removing the content if needed.',
  },
  {
    question: 'What should I share?',
    answer:
      'Anything your team benefits from: company announcements, project milestones, helpful questions and celebrations. If it keeps your colleagues in the loop, it belongs on the feed.',
  },
];

export default function Home() {
  const router = useRouter();

  // The landing page is for logged-out visitors: once authenticated, send
  // them straight to the feed.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!cancelled && res.ok) {
          router.replace('/feed');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Head>
        <title>ConnectSocial — Your team's private social network</title>
        <meta
          name="description"
          content="A private social network for your company or team. Share updates, celebrate wins, discuss in comments and never miss what matters — in one friendly feed."
        />
      </Head>

      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
        {/* Hero */}
        <section className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70">
          <div className="p-8 sm:p-12">
            <div className="flex items-center gap-3">
              <img
                src="/logo.svg"
                alt="ConnectSocial logo"
                className="h-10 w-10 shrink-0"
              />
              <span className="text-lg font-semibold tracking-tight">
                ConnectSocial
              </span>
            </div>

            <h1 className="mt-8 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              The private social network
              <br className="hidden sm:block" /> for your whole team.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              ConnectSocial gives your company one friendly feed for every update,
              announcement and win. No more hunting through email threads or chat
              channels to find out what your colleagues are working on — post
              once, and everyone stays in the loop.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="rounded-2xl bg-indigo-600 px-7 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Log in to ConnectSocial
              </Link>
              <p className="max-w-xs text-sm text-slate-500">
                Private to your company — only invited teammates can see what
                your team shares.
              </p>
            </div>
          </div>
        </section>

        {/* How it helps */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Why teams use ConnectSocial
          </h2>
          <p className="mt-2 text-slate-600">
            A small amount of structure goes a long way when a company is
            trying to communicate well.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <span className="text-2xl">{feature.emoji}</span>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Who it helps */}
        <section className="mt-16 rounded-3xl bg-white p-8 shadow-sm sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            Who finds it helpful
          </h2>
          <ul className="mt-6 space-y-4">
            {AUDIENCES.map((audience) => (
              <li key={audience} className="flex items-start gap-3 text-slate-700">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm text-emerald-600">
                  ✓
                </span>
                <span className="leading-7">{audience}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 border-t border-slate-100 pt-8 text-sm text-slate-500">
            ConnectSocial is built for teams that would rather stay connected
            than chase updates. Your news, your people, one feed.
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 rounded-3xl bg-white p-8 shadow-sm sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <p className="mt-2 text-slate-600">
            How ConnectSocial works for your company.
          </p>

          <div className="mt-6 divide-y divide-slate-100">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-slate-900">
                  {faq.question}
                  <span className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/login"
            className="inline-block rounded-2xl bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Ready to catch up with your team? Log in
          </Link>
        </div>
      </div>
    </main>
  );
}