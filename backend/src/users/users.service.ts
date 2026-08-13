import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../auth/roles.enum';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const defaultUsers = [
      { username: 'admin', password: 'password', role: Role.SuperAdmin },
      { username: 'moderator', password: 'password', role: Role.Moderator },
      { username: 'user', password: 'password', role: Role.RegularUser },
      { username: 'guest', password: 'guest', role: Role.Guest },
    ];

    for (const u of defaultUsers) {
      const existing = await this.userRepository.findOne({ where: { username: u.username } });
      if (!existing) {
        const newUser = this.userRepository.create(u);
        await this.userRepository.save(newUser);
      }
    }
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async create(userDto: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userDto);
    return this.userRepository.save(user);
  }
}
