import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users/entities/user.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  getStatus() {
    return { status: 'ok', message: 'ConnectSocial backend is running' };
  }

  async testConnection() {
    const count = await this.userRepository.count();
    const sample = await this.userRepository.findOne({ where: { userId: 1 } });
    return {
      userCount: count,
      sampleUser: sample ? { userId: sample.userId, username: sample.username } : null,
      timestamp: new Date().toISOString(),
    };
  }
}
