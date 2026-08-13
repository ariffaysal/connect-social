const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6'];

export default function Avatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-24 w-24 text-3xl',
  };
  const initial = (name || '?').charAt(0).toUpperCase();
  const colorIndex = (name || '').charCodeAt(0) % COLORS.length;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'avatar'}
        referrerPolicy="no-referrer"
        className={`${sizes[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ backgroundColor: COLORS[colorIndex] }}
    >
      {initial}
    </span>
  );
}
