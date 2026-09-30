import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageLog } from './entities/message-log.entity';
import { User } from '../users/entities/user.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

/** Default lifetime of a live conversation message, in minutes. */
export const DEFAULT_RETENTION_MINUTES = 60;

/** How often the retention sweep runs. */
const PURGE_INTERVAL_MS = 60_000;

/** Cap how many rows a single conversation scan pulls, to bound memory. */
const SCAN_LIMIT = 2000;

export type MessagePage = {
  messages: Message[];
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
  lastAt: Date;
  lastFromMe: boolean;
  messageCount: number;
};

export type AdminConversationSummary = {
  participantA: { userId: number; username: string; fullName?: string; avatarUrl?: string };
  participantB: { userId: number; username: string; fullName?: string; avatarUrl?: string };
  lastMessage: string;
  lastAt: Date;
  messageCount: number;
};

/** Live conversation retention window, in minutes (`MESSAGE_RETENTION_MINUTES`). */
export function resolveRetentionMinutes(): number {
  const raw = Number(process.env.MESSAGE_RETENTION_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_MINUTES;
}

/** Whether each message is also mirrored into the admin monitoring table. */
export function isAuditEnabled(): boolean {
  return process.env.MESSAGE_AUDIT_ENABLED !== 'false';
}

@Injectable()
export class MessagesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagesService.name);
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageLog)
    private readonly messageLogRepository: Repository<MessageLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly realtimeService: RealtimeService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  onModuleInit() {
    // Sweep once on boot (rows may have expired while the server was down),
    // then keep sweeping every minute so retention is enforced continuously.
    void this.sweep();
    this.purgeTimer = setInterval(() => void this.sweep(), PURGE_INTERVAL_MS);
    // Don't keep the process (or a jest run) alive just for the sweeper.
    this.purgeTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.purgeTimer = null;
  }

  private retentionCutoff(): Date {
    return new Date(Date.now() - resolveRetentionMinutes() * 60 * 1000);
  }

  private async sweep() {
    try {
      const removed = await this.purgeExpired();
      if (removed > 0) {
        this.logger.log(`Purged ${removed} message(s) older than the retention window`);
      }
    } catch (err) {
      this.logger.warn(`Message retention sweep failed: ${(err as Error).message}`);
    }
  }

  /** Delete every live message older than the retention window. */
  async purgeExpired(): Promise<number> {
    const result = await this.messageRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoff', { cutoff: this.retentionCutoff() })
      .execute();
    return result.affected ?? 0;
  }

  /** Send a direct message from one user to another. */
  async send(
    sender: { userId: number; username: string },
    recipientId: number,
    content: string,
  ): Promise<Message> {
    if (recipientId === sender.userId) {
      throw new BadRequestException('You cannot message yourself');
    }

    const recipient = await this.userRepository.findOne({ where: { userId: recipientId } });
    if (!recipient || !recipient.isActive) {
      throw new NotFoundException('Recipient not found');
    }

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        senderId: sender.userId,
        senderUsername: sender.username,
        recipientId: recipient.userId,
        recipientUsername: recipient.username,
        content,
      }),
    );

    if (isAuditEnabled()) {
      try {
        await this.messageLogRepository.save(
          this.messageLogRepository.create({
            messageId: message.id,
            senderId: message.senderId,
            senderUsername: message.senderUsername,
            recipientId: message.recipientId,
            recipientUsername: message.recipientUsername,
            content: message.content,
            createdAt: message.createdAt,
          }),
        );
      } catch (err) {
        // Never fail the send because the audit mirror failed.
        this.logger.warn(`Message audit mirror failed: ${(err as Error).message}`);
      }
    }

    // Push live to both sides so the recipient sees it instantly and the
    // sender's other tabs stay in sync.
    this.realtimeService.sendToUser(recipient.userId, 'messages:new', { message });
    this.realtimeService.sendToUser(sender.userId, 'messages:new', { message });

    await this.activityLogService
      .log({
        userId: sender.userId,
        username: sender.username,
        action: ActivityAction.MessageSent,
        detail: `Sent a direct message to ${recipient.username}`,
      })
      .catch(() => undefined);

    return message;
  }

  /** Conversation between two users, oldest page first. */
  async threadBetween(
    userId: number,
    otherUserId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<MessagePage> {
    await this.sweep();

    const take = Math.min(Math.max(1, options.limit ?? 50), 200);
    const skip = Math.max(0, options.offset ?? 0);

    const [rows, total] = await this.messageRepository.findAndCount({
      where: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId },
      ],
      order: { createdAt: 'DESC', id: 'DESC' },
      take,
      skip,
    });

    return {
      messages: rows.reverse(),
      total,
      hasMore: skip + rows.length < total,
      retentionMinutes: resolveRetentionMinutes(),
    };
  }

  /** Conversation summaries for one user, most recent first. */
  async conversations(userId: number): Promise<ConversationSummary[]> {
    await this.sweep();

    const rows = await this.messageRepository.find({
      where: [{ senderId: userId }, { recipientId: userId }],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: SCAN_LIMIT,
    });

    const summaries = new Map<number, ConversationSummary>();
    for (const row of rows) {
      const fromMe = row.senderId === userId;
      const otherUserId = fromMe ? row.recipientId : row.senderId;
      const otherUsername = fromMe ? row.recipientUsername : row.senderUsername;
      const existing = summaries.get(otherUserId);
      if (existing) {
        existing.messageCount += 1;
        continue;
      }
      summaries.set(otherUserId, {
        otherUserId,
        otherUsername,
        lastMessage: row.content,
        lastAt: row.createdAt,
        lastFromMe: fromMe,
        messageCount: 1,
      });
    }

    await this.attachParticipants([...summaries.values()].map((s) => s.otherUserId), (user) => {
      const summary = summaries.get(user.userId);
      if (summary) {
        summary.otherFullName = user.fullName;
        summary.otherAvatarUrl = user.avatarUrl;
      }
    });

    return [...summaries.values()].sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
  }

  /** Every conversation on the platform, for management monitoring. */
  async adminConversations(limit = 50): Promise<AdminConversationSummary[]> {
    await this.sweep();

    const take = Math.min(Math.max(1, limit), 200);
    const rows = await this.messageRepository.find({
      order: { createdAt: 'DESC', id: 'DESC' },
      take: SCAN_LIMIT,
    });

    type Draft = {
      aId: number;
      aUsername: string;
      bId: number;
      bUsername: string;
      lastMessage: string;
      lastAt: Date;
      messageCount: number;
    };
    const drafts = new Map<string, Draft>();
    for (const row of rows) {
      const [aId, aUsername, bId, bUsername] =
        row.senderId < row.recipientId
          ? [row.senderId, row.senderUsername, row.recipientId, row.recipientUsername]
          : [row.recipientId, row.recipientUsername, row.senderId, row.senderUsername];
      const key = `${aId}:${bId}`;
      const existing = drafts.get(key);
      if (existing) {
        existing.messageCount += 1;
        continue;
      }
      drafts.set(key, {
        aId,
        aUsername,
        bId,
        bUsername,
        lastMessage: row.content,
        lastAt: row.createdAt,
        messageCount: 1,
      });
    }

    const users = await this.loadUsers([
      ...drafts.values()].flatMap((d) => [d.aId, d.bId]),
    );

    return [...drafts.values()]
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
      .slice(0, take)
      .map((draft) => ({
        participantA: this.participant(users, draft.aId, draft.aUsername),
        participantB: this.participant(users, draft.bId, draft.bUsername),
        lastMessage: draft.lastMessage,
        lastAt: draft.lastAt,
        messageCount: draft.messageCount,
      }));
  }

  /** Monitoring view of one conversation (audit archive included). */
  async adminThread(userA: number, userB: number, options: { limit?: number; offset?: number } = {}) {
    await this.sweep();

    const take = Math.min(Math.max(1, options.limit ?? 100), 500);
    const skip = Math.max(0, options.offset ?? 0);

    const [rows, total] = await this.messageLogRepository.findAndCount({
      where: [
        { senderId: userA, recipientId: userB },
        { senderId: userB, recipientId: userA },
      ],
      order: { createdAt: 'DESC', id: 'DESC' },
      take,
      skip,
    });

    return { messages: rows.reverse(), total, hasMore: skip + rows.length < total };
  }

  private async loadUsers(ids: number[]) {
    const unique = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0);
    if (unique.length === 0) return new Map<number, User>();
    const users = await this.userRepository.find({
      where: { userId: In(unique) },
      select: {
        userId: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });
    return new Map(users.map((user) => [user.userId, user]));
  }

  private participant(users: Map<number, User>, userId: number, username: string) {
    const user = users.get(userId);
    return {
      userId,
      username: user?.username ?? username,
      fullName: user?.fullName,
      avatarUrl: user?.avatarUrl,
    };
  }

  private async attachParticipants(ids: number[], apply: (user: User) => void) {
    const users = await this.loadUsers(ids);
    for (const user of users.values()) apply(user);
  }
}
