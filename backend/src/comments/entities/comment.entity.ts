import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index('IDX_comment_owner_created_at', ['ownerId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  content!: string;

  @Index('IDX_comment_post_created')
  @Column()
  postId!: number;

  @Index('IDX_comment_owner')
  @Column()
  ownerId!: number;

  @Column()
  ownerUsername!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
