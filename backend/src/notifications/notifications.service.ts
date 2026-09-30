import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async create(input: {
    recipientId: number;
    actorId: number;
    actorUsername: string;
    type: NotificationType;
    content: string;
    postId?: number;
    commentId?: number;
  }): Promise<Notification> {
    const notification = this.notificationRepository.create(input);
    return this.notificationRepository.save(notification);
  }

  /** Bulk-create notifications (used for system-wide announcements). */
  async createMany(
    inputs: Array<{
      recipientId: number;
      actorId: number;
      actorUsername: string;
      type: NotificationType;
      content: string;
      postId?: number;
      commentId?: number;
    }>,
  ): Promise<Notification[]> {
    if (inputs.length === 0) return [];
    const notifications = inputs.map((input) => this.notificationRepository.create(input));
    return this.notificationRepository.save(notifications);
  }

  async forUser(recipientId: number, limit = 50): Promise<any[]> {
    const notifications = await this.notificationRepository.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    if (notifications.length === 0) return [];

    // Attach opaque refs so the UI can deep-link to a profile/post without
    // putting sequential ids in the URL.
    const actorIds = [...new Set(notifications.map((n) => n.actorId))];
    const postIds = [
      ...new Set(
        notifications
          .map((n) => n.postId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const [actors, posts] = await Promise.all([
      this.userRepository.find({
        where: { userId: In(actorIds) },
        select: { userId: true, publicId: true },
      }),
      postIds.length > 0
        ? this.postRepository.find({
            where: { id: In(postIds) },
            select: { id: true, publicId: true },
          })
        : Promise.resolve([]),
    ]);
    const actorMap = new Map(actors.map((a) => [a.userId, a.publicId ?? null]));
    const postMap = new Map(posts.map((p) => [p.id, p.publicId ?? null]));

    return notifications.map((notification) => ({
      ...notification,
      actorPublicId: actorMap.get(notification.actorId) ?? null,
      postPublicId:
        notification.postId !== undefined && notification.postId !== null
          ? postMap.get(notification.postId) ?? null
          : null,
    }));
  }

  async unreadCount(recipientId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { recipientId, isRead: false },
    });
  }

  /** Clean up old read notifications to keep the table lean. */
  async cleanupOldNotifications(olderThanDays = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .where('isRead = :isRead', { isRead: true })
      .andWhere('createdAt < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
    return result.affected ?? 0;
  }

  async markRead(id: number, recipientId: number): Promise<boolean> {
    const result = await this.notificationRepository.update(
      { id, recipientId },
      { isRead: true },
    );
    return (result.affected ?? 0) > 0;
  }

  async markAllRead(recipientId: number): Promise<void> {
    await this.notificationRepository.update({ recipientId }, { isRead: true });
  }
}
