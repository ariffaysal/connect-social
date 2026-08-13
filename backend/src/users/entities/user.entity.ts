import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../auth/roles.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  userId!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  password?: string; // Storing plain text for demo, or you could hash it

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.Guest,
  })
  role!: Role;
}
