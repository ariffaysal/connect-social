import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Unique, Index } from 'typeorm';

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

  @Index('IDX_reaction_post')
  @Column({ nullable: true })
  postId?: number;

  @Index('IDX_reaction_comment')
  @Column({ nullable: true })
  commentId?: number;

  @Index('IDX_reaction_owner_post')
  @Column()
  ownerId!: number;

  @Column()
  ownerUsername!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
