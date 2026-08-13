import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Unique } from 'typeorm';

export enum ReactionType {
  Like = 'like',
  Love = 'love',
  Wow = 'wow',
}

@Entity()
@Unique(['ownerId', 'postId'])
@Unique(['ownerId', 'commentId'])
export class Reaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: ReactionType })
  type!: ReactionType;

  @Column({ nullable: true })
  postId?: number;

  @Column({ nullable: true })
  commentId?: number;

  @Column()
  ownerId!: number;

  @Column()
  ownerUsername!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
