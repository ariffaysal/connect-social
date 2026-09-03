import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Reaction, ReactionType } from '../reactions/entities/reaction.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../auth/roles.enum';
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private async resolveViewer(userId?: number): Promise<User | null> {
    if (!userId) return null;
    return this.userRepository.findOne({ where: { userId } });
  }

  private hasAllAccess(user: User | null): boolean {
    return !!user &&
      (user.role === Role.SuperAdmin ||
        user.role === Role.Moderator ||
        user.allDepartmentsAccess === true);
  }

  /**
   * Feed query rules:
   * - No filter: posts visible to the viewer (SuperAdmin/Moderator/
   *   all-departments users see everything; users of a single department
   *   see their group + company-wide posts; everyone else only company posts).
   * - ?departmentId=X: company-wide posts are shown in every group view.
   * - ?scope=company: only company-wide (unassigned) posts.
   */
  async findAll(
    options: { departmentId?: number; scope?: string } = {},
    viewerId?: number,
  ): Promise<any[]> {
    const viewer = await this.resolveViewer(viewerId);
    const globalView = this.hasAllAccess(viewer);

    let where:
      | Record<string, unknown>
      | Record<string, unknown>[];
    if (options.scope === 'company') {
      where = { departmentId: IsNull() };
    } else if (options.departmentId !== undefined) {
      if (!globalView && viewer?.departmentId !== options.departmentId) {
        throw new ForbiddenException("You don't have access to this department");
      }
      where = [
        { departmentId: options.departmentId },
        { departmentId: IsNull() },
      ];
    } else {
      // Home feed
      if (globalView) {
        where = {};
      } else if (viewer?.departmentId) {
        where = [
          { departmentId: viewer.departmentId },
          { departmentId: IsNull() },
        ];
      } else {
        where = { departmentId: IsNull() };
      }
    }

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
      const myReaction = viewerId
        ? reactions.find((r) => r.ownerId === viewerId)?.type ?? null
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

  /**
   * Whether a viewer may see a specific post. Company-wide posts are public;
   * department posts require membership in that department (or global access).
   */
  async canViewPost(userId: number | undefined, departmentId?: number | null): Promise<boolean> {
    if (!departmentId) return true;
    if (!userId) return false;
    const user = await this.resolveViewer(userId);
    if (this.hasAllAccess(user)) return true;
    return user?.departmentId === departmentId;
  }

  async create(
    ownerId: number,
    ownerUsername: string,
    title: string,
    content: string,
    imageUrl?: string,
    departmentId?: number,
  ): Promise<Post> {
    if (departmentId !== undefined) {
      const user = await this.resolveViewer(ownerId);
      const allowed =
        this.hasAllAccess(user) || user?.departmentId === departmentId;
      if (!allowed) {
        throw new ForbiddenException("You can't post to this department");
      }
    }
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
    const current = await this.findOne(id);
    if (!current) throw new NotFoundException('Post not found');
    if (
      partial.departmentId !== undefined &&
      partial.departmentId !== current.departmentId
    ) {
      throw new ForbiddenException('A post cannot be moved to another department');
    }
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
