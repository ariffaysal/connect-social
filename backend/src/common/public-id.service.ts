import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { generatePublicId } from './public-ref';

/**
 * Fills in `publicId` for rows that predate the column (i.e. every existing
 * account and post at deploy time). New rows get their ref from the
 * `@BeforeInsert` hook on the entity, so this only ever touches legacy data
 * and is a no-op on every boot after the first.
 */
@Injectable()
export class PublicIdService implements OnModuleInit {
  private readonly logger = new Logger(PublicIdService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async onModuleInit() {
    try {
      const users = await this.backfill(this.userRepository);
      const posts = await this.backfill(this.postRepository);
      if (users + posts > 0) {
        this.logger.log(`Assigned public refs to ${users} user(s) and ${posts} post(s)`);
      }
    } catch (err) {
      this.logger.warn(`Public ref backfill skipped: ${(err as Error).message}`);
    }
  }

  private async backfill(repository: Repository<any>): Promise<number> {
    const missing = await repository
      .createQueryBuilder('row')
      .where('row.publicId IS NULL')
      .orWhere("row.publicId = ''")
      .getMany();
    if (missing.length === 0) return 0;

    for (const row of missing) {
      row.publicId = generatePublicId();
    }
    await repository.save(missing);
    return missing.length;
  }
}
