import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Role } from '../../auth/roles.enum';
import { generatePublicId } from '../../common/public-ref';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  userId!: number;

  /**
   * Opaque, non-guessable ref used in URLs (`/profile/<publicId>`). Never
   * change it once issued: links and bookmarks depend on it.
   */
  @Index('IDX_user_public_id', { unique: true })
  @Column({ type: 'varchar', length: 32, nullable: true })
  publicId?: string;

  @BeforeInsert()
  assignPublicId() {
    if (!this.publicId) this.publicId = generatePublicId();
  }

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

  /**
   * Session generation counter, embedded in issued JWTs as `ver`.
   *
   * Bumped whenever credentials or access change (password reset, account
   * deactivated), which invalidates every token issued before that moment.
   * Without it a password reset leaves old sessions alive until the token
   * expires — the opposite of what "reset the admin password" is meant to do.
   */
  @Column({ default: 0 })
  tokenVersion!: number;

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
