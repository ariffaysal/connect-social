import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Reaction, ReactionType } from '../reactions/entities/reaction.entity';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async findAll(options: { departmentId?: number } = {}, currentUserId?: number): Promise<any[]> {
    const where = options.departmentId ? { departmentId: options.departmentId } : {};
    const posts = await this.postRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);

    const [commentRows, reactionRows] = await Promise.all([
      this.commentRepository
        .createQueryBuilder('c')
        .select('c.postId', 'postId')
        .addSelect('COUNT(c.id)', 'cnt')
        .where('c.postId IN (:...ids)', { ids: postIds })
        .groupBy('c.postId')
        .getRawMany(),
      this.reactionRepository.find({ where: { postId: In(postIds) } }),
    ]);

    const commentMap = new Map(commentRows.map((r: any) => [Number(r.postId), Number(r.cnt)]));

    const reactionMap = new Map<number, Reaction[]>();
    for (const r of reactionRows) {
      const list = reactionMap.get(r.postId!) ?? [];
      list.push(r);
      reactionMap.set(r.postId!, list);
    }

    return posts.map((post) => {
      const reactions = reactionMap.get(post.id) ?? [];
      const counts: Record<ReactionType, number> = { like: 0, love: 0, wow: 0 };
      for (const r of reactions) counts[r.type] += 1;
      const myReaction = currentUserId
        ? reactions.find((r) => r.ownerId === currentUserId)?.type ?? null
        : null;

      return {
        ...post,
        commentsCount: commentMap.get(post.id) ?? 0,
        reactions: { counts, total: reactions.length, my: myReaction },
      };
    });
  }

  async findOne(id: number): Promise<Post | null> {
    return this.postRepository.findOne({ where: { id } });
  }

  async create(
    ownerId: number,
    ownerUsername: string,
    title: string,
    content: string,
    imageUrl?: string,
    departmentId?: number,
  ): Promise<Post> {
    const post = this.postRepository.create({
      ownerId,
      ownerUsername,
      title,
      content,
      imageUrl,
      departmentId,
    });
    const saved = await this.postRepository.save(post);
    await this.activityLogService.log({
      userId: ownerId,
      username: ownerUsername,
      action: ActivityAction.PostCreated,
      detail: `Created post "${title}"`,
    });
    return saved;
  }

  async update(id: number, partial: Partial<Post>): Promise<Post | null> {
    await this.postRepository.update(id, partial);
    return this.findOne(id);
  }

  async delete(id: number): Promise<boolean> {
    await this.commentRepository.delete({ postId: id });
    await this.reactionRepository.delete({ postId: id });
    const result = await this.postRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
