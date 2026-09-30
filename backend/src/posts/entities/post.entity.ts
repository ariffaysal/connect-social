import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { generatePublicId } from '../../common/public-ref';

@Entity()
@Index('IDX_post_owner_created_at', ['ownerId', 'createdAt'])
@Index('IDX_post_department_created_at', ['departmentId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Opaque, non-guessable ref used in permalinks (`/feed?post=<publicId>`). */
  @Index('IDX_post_public_id', { unique: true })
  @Column({ type: 'varchar', length: 32, nullable: true })
  publicId?: string;

  @BeforeInsert()
  assignPublicId() {
    if (!this.publicId) this.publicId = generatePublicId();
  }

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ nullable: true })
  departmentId?: number;

  @Column()
  ownerId!: number;

  @Column()
  ownerUsername!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
