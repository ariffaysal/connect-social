import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * A single direct message between two users.
 *
 * Rows in this table are short-lived: the MessagesService deletes anything
 * older than `MESSAGE_RETENTION_MINUTES` (default 60) so conversations are
 * only kept for one hour. Long-term management visibility lives in
 * {@link MessageLog}.
 */
@Entity()
@Index('IDX_message_pair_created', ['senderId', 'recipientId', 'createdAt'])
@Index('IDX_message_sender', ['senderId'])
@Index('IDX_message_recipient', ['recipientId'])
@Index('IDX_message_created', ['createdAt'])
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  senderId!: number;

  @Column()
  senderUsername!: string;

  @Column()
  recipientId!: number;

  @Column()
  recipientUsername!: string;

  @Column('text')
  content!: string;

  /**
   * When the recipient opened the conversation. NULL means unread, which is
   * what powers the instant badge/show-inbox behaviour over WebSocket.
   */
  @Index('IDX_message_read_at')
  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
