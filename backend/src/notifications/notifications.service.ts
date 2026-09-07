import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
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

  async forUser(recipientId: number, limit = 50): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
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
