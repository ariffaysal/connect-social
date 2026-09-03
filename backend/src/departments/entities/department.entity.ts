import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Department {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ default: '#6366f1' })
  color!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
