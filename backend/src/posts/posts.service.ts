import {
  Injectable,
  ForbiddenException,
  Logger,
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
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

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
    private readonly notificationsService: NotificationsService,
    private readonly realtimeService: RealtimeService,
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

  private async addPostDetails(posts: Post[], viewerId?: number): Promise<any[]> {
    if (posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);

    // Owners' avatars so the feed can show profile pictures on post cards.
    const ownerIds = [...new Set(posts.map((p) => p.ownerId))];
    const owners = await this.userRepository.find({
      where: { userId: In(ownerIds) },
      select: { userId: true, avatarUrl: true },
    });
    const avatarMap = new Map(owners.map((u) => [u.userId, u.avatarUrl ?? null]));

    const [commentRows, reactionRows] = await Promise.all([
      this.commentRepository
        .createQueryBuilder('c')
        .select('c.postId', 'postId')
        .addSelect('COUNT(c.id)', 'cnt')
        .where('c.postId IN (:...ids)', { ids: postIds })
        .groupBy('c.postId')
        .getRawMany(),
      this.reactionRepository.find({
        where: { postId: In(postIds) },
      }),
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
        ownerAvatarUrl: avatarMap.get(post.ownerId) ?? null,
        commentsCount: commentMap.get(post.id) ?? 0,
        reactions: { counts, total: reactions.length, my: myReaction },
      };
    });
  }

  /**
   * Feed query rules:
   *
   * Pagination: defaults to 30 posts per page. Offset-based pagination for
   * simplicity; cursor-based (id/date) pagination can be added later for
   * very large feeds to avoid skipped/duplicated items on concurrent writes.
   *
   * - No filter: posts visible to the viewer (SuperAdmin/Moderator/
   *   all-departments users see everything; users of a single department
   *   see their group + company-wide posts; everyone else only company posts).
   * - ?departmentId=X: company-wide posts are shown in every group view.
   * - ?scope=company: only company-wide (unassigned) posts.
   */
  async findAll(
    options: { departmentId?: number; scope?: string; limit?: number; offset?: number } = {},
    viewerId?: number,
  ): Promise<{ posts: any[]; total: number; hasMore: boolean }> {
    const viewer = await this.resolveViewer(viewerId);
    const globalView = this.hasAllAccess(viewer);

    const limit = Math.min(options.limit ?? 30, 100); // cap at 100
    const offset = options.offset ?? 0;

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

    // Get total count for pagination metadata
    const total = await this.postRepository.count({ where });

    const posts = await this.postRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      posts: await this.addPostDetails(posts, viewerId),
      total,
      hasMore: offset + posts.length < total,
    };
  }

  async findByOwner(
    ownerId: number,
    options: { limit?: number; offset?: number } = {},
    viewerId?: number,
  ): Promise<{ posts: any[]; total: number; hasMore: boolean }> {
    const viewer = await this.resolveViewer(viewerId);
    const globalView = this.hasAllAccess(viewer);
    const limit = Math.min(options.limit ?? 30, 100);
    const offset = options.offset ?? 0;

    let where:
      | Record<string, unknown>
      | Record<string, unknown>[];
    if (globalView) {
      where = { ownerId };
    } else if (viewer?.departmentId) {
      where = [
        { ownerId, departmentId: viewer.departmentId },
        { ownerId, departmentId: IsNull() },
      ];
    } else {
      where = { ownerId, departmentId: IsNull() };
    }

    const total = await this.postRepository.count({ where });
    const posts = await this.postRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      posts: await this.addPostDetails(posts, viewerId),
      total,
      hasMore: offset + posts.length < total,
    };
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

    // Notification fan-out can touch every active account. Do it after the
    // post is committed so publishing stays fast; the WebSocket path remains
    // best-effort and the database notifications provide the fallback.
    void this.notifyUsersOfNewPost(saved, ownerId, ownerUsername, title).catch((err) => {
      this.logger.error(`Post notification fan-out failed: ${err?.message ?? err}`);
    });

    return saved;
  }

  private async notifyUsersOfNewPost(
    post: Post,
    ownerId: number,
    ownerUsername: string,
    title: string,
  ): Promise<void> {

    // Live "new post" announcement: notify every active user except the
    // author, then push notifications:new to their connected sockets so the
    // bell badge bumps instantly (15s polling stays as fallback).
    //
    // OPTIMIZATION: Use batched inserts and defer WebSocket sends to avoid
    // blocking the response. In high-traffic scenarios, consider a message
    // queue (Redis/Bull) for notification dispatch.
    const activeUsers = await this.userRepository.find({
      where: { isActive: true },
      select: { userId: true },
    });
    const recipients = activeUsers.filter((u) => u.userId !== ownerId);
    if (recipients.length > 0) {
      const shortTitle = title.length > 80 ? `${title.slice(0, 80)}…` : title;
      const notifications = await this.notificationsService.createMany(
        recipients.map((u) => ({
          recipientId: u.userId,
          actorId: ownerId,
          actorUsername: ownerUsername,
          type: NotificationType.System,
          content: `“${shortTitle}”`,
          postId: post.id,
        })),
      );
      // Send WebSocket notifications (non-blocking fire-and-forget)
      for (const notification of notifications) {
        this.realtimeService.sendToUser(notification.recipientId, 'notifications:new', {
          notification,
        });
      }
    }
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
