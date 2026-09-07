import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  Comment = 'comment',
  Reaction = 'reaction',
  Mention = 'mention',
  System = 'system',
}

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_notification_recipient_read')
  @Column()
  recipientId!: number;

  @Column()
  actorId!: number;

  @Column()
  actorUsername!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ nullable: true })
  postId?: number;

  @Column({ nullable: true })
  commentId?: number;

  @Column('text')
  content!: string;

  @Column({ default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
