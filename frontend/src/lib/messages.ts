export type DirectMessage = {
  id: number;
  senderId: number;
  senderUsername: string;
  recipientId: number;
  recipientUsername: string;
  content: string;
  createdAt: string;
};

export type MessagePage = {
  messages: DirectMessage[];
  total: number;
  hasMore: boolean;
  retentionMinutes: number;
};

export type ConversationSummary = {
  otherUserId: number;
  otherUsername: string;
  otherFullName?: string;
  otherAvatarUrl?: string;
  lastMessage: string;
  lastAt: string;
  lastFromMe: boolean;
  messageCount: number;
};

export type AdminConversationSummary = {
  participantA: { userId: number; username: string; fullName?: string; avatarUrl?: string };
  participantB: { userId: number; username: string; fullName?: string; avatarUrl?: string };
  lastMessage: string;
  lastAt: string;
  messageCount: number;
};

export type MonitoredMessage = {
  id: number;
  messageId?: number;
  senderId: number;
  senderUsername: string;
  recipientId: number;
  recipientUsername: string;
  content: string;
  createdAt: string;
};

export type RetentionInfo = {
  retentionMinutes: number;
  auditEnabled: boolean;
};

export function retentionLabel(minutes: number | undefined): string {
  const value = minutes ?? 60;
  if (value % 60 === 0) {
    const hours = value / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${value} minutes`;
}

/** Short clock label for a chat bubble. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Day separator label ("Today", "Yesterday", or a date) for a chat day. */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
