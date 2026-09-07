import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Role } from '../../auth/roles.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  userId!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  password?: string;

  @Column({ type: 'enum', enum: Role, default: Role.Guest })
  role!: Role;

  @Column({ default: '' })
  fullName!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ default: '' })
  jobTitle!: string;

  @Column('text', { nullable: true })
  bio?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Index('IDX_user_department')
  @Column({ nullable: true })
  departmentId?: number;

  @Column({ default: false })
  allDepartmentsAccess!: boolean;

  @Index('IDX_user_active')
  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 0 })
  loginCount!: number;

  @Index('IDX_user_last_login')
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Index('IDX_user_last_seen')
  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
