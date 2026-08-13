import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
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

  @Column({ nullable: true })
  departmentId?: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 0 })
  loginCount!: number;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  lastSeenAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
