import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum ActivityAction {
  Login = 'login',
  PostCreated = 'post_created',
  CommentCreated = 'comment_created',
  ReactionAdded = 'reaction_added',
  ReportFiled = 'report_filed',
  Moderation = 'moderation',
  AccountCreated = 'account_created',
  AccountUpdated = 'account_updated',
  ProfileUpdated = 'profile_updated',
}

@Entity()
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_activity_user_created')
  @Column()
  userId!: number;

  @Column()
  username!: string;

  @Index('IDX_activity_action')
  @Column({ type: 'enum', enum: ActivityAction })
  action!: ActivityAction;

  @Column('text', { nullable: true })
  detail?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
