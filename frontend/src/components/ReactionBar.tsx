import { useMemo } from 'react';

export type ReactionSummary = {
  counts: { like: number; love: number; wow: number };
  total: number;
  my: 'like' | 'love' | 'wow' | null;
};

const REACTION_META: Record<string, { label: string; emoji: string }> = {
  like: { label: 'Like', emoji: '👍' },
  love: { label: 'Love', emoji: '❤️' },
  wow: { label: 'Wow', emoji: '😮' },
};

export default function ReactionBar({
  reactions,
  onReact,
  disabled,
  compact = false,
}: {
  reactions?: ReactionSummary;
  onReact: (type: 'like' | 'love' | 'wow') => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const summary = useMemo<ReactionSummary>(
    () => reactions ?? { counts: { like: 0, love: 0, wow: 0 }, total: 0, my: null },
    [reactions],
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          disabled={disabled}
          onClick={() => onReact('like')}
          className={`font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
            summary.my === 'like' ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'
          }`}
        >
          Like {summary.counts.like > 0 && `(${summary.counts.like})`}
        </button>
        {summary.total > 0 && (
          <span className="text-slate-500">
            {[0, 1, 2].map(
              (i) =>
                summary.counts[['like', 'love', 'wow'][i] as 'like' | 'love' | 'wow'] > 0 && (
                  <span key={i} title={['like', 'love', 'wow'][i]}>
                    {REACTION_META[['like', 'love', 'wow'][i]].emoji}
                  </span>
                ),
            )}{' '}
            {summary.total}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {(['like', 'love', 'wow'] as const).map((type) => {
        const active = summary.my === type;
        return (
          <button
            key={type}
            disabled={disabled}
            onClick={() => onReact(type)}
            title={REACTION_META[type].label}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="text-base">{REACTION_META[type].emoji}</span>
            <span>{summary.counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
