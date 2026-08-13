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

  async forUser(recipientId: number): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async unreadCount(recipientId: number): Promise<number> {
    return this.notificationRepository.count({ where: { recipientId, isRead: false } });
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
