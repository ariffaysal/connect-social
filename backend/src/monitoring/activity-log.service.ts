import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
  ) {}

  async log(input: {
    userId: number;
    username: string;
    action: ActivityAction;
    detail?: string;
  }): Promise<ActivityLog> {
    const entry = this.activityRepository.create(input);
    return this.activityRepository.save(entry);
  }

  async recent(limit = 50): Promise<ActivityLog[]> {
    return this.activityRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async forUser(userId: number, limit = 50): Promise<ActivityLog[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
