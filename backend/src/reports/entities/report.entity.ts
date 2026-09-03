import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum ReportTargetType {
  Post = 'post',
  Comment = 'comment',
}

export enum ReportStatus {
  Pending = 'pending',
  Resolved = 'resolved',
  Dismissed = 'dismissed',
}

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: ReportTargetType })
  targetType!: ReportTargetType;

  @Column()
  targetId!: number;

  @Column('text')
  reason!: string;

  @Column()
  reporterId!: number;

  @Column()
  reporterUsername!: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.Pending })
  status!: ReportStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date;

  @Column({ nullable: true })
  resolvedById?: number;
}
