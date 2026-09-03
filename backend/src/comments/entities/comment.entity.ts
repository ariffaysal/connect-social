import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  content!: string;

  @Column()
  postId!: number;

  @Column()
  ownerId!: number;

  @Column()
  ownerUsername!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
