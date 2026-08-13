import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  @Column()
  ownerId!: number;

  @Column()
  ownerUsername!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
