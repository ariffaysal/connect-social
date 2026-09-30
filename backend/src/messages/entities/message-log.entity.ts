import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Monitoring/audit copy of every direct message, keyed by sender and recipient
 * user ids so management can review conversations even after the live
 * `message` rows are purged by the 60-minute retention policy.
 *
 * Only SuperAdmins/Moderators can read this table (via the admin conversation
 * endpoints). Set `MESSAGE_AUDIT_ENABLED=false` to stop writing these rows and
 * keep conversations truly ephemeral.
 */
@Entity()
@Index('IDX_message_log_pair_created', ['senderId', 'recipientId', 'createdAt'])
@Index('IDX_message_log_created', ['createdAt'])
export class MessageLog {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Id of the originating `message` row (0 when the row is unknown). */
  @Column({ default: 0 })
  messageId!: number;

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

  @CreateDateColumn()
  createdAt!: Date;
}
