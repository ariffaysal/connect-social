import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { Reaction, ReactionType } from '../reactions/entities/reaction.entity';
import { PostsService } from '../posts/posts.service';
import { Role } from '../auth/roles.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    private readonly postsService: PostsService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async findByPost(postId: number, currentUserId?: number): Promise<any[]> {
    const comments = await this.commentRepository.find({
      where: { postId },
      order: { createdAt: 'ASC' },
    });

    if (comments.length === 0) return [];

    // Owners' avatars so the UI can show profile pictures next to comments.
    const ownerIds = [...new Set(comments.map((c) => c.ownerId))];
    const owners = await this.userRepository.find({
      where: { userId: In(ownerIds) },
      select: { userId: true, avatarUrl: true },
    });
    const avatarMap = new Map(owners.map((u) => [u.userId, u.avatarUrl ?? null]));

    const commentIds = comments.map((c) => c.id);
    const reactions = await this.reactionRepository.find({
      where: { commentId: In(commentIds) },
    });

    const reactionMap = new Map<number, Reaction[]>();
    for (const r of reactions) {
      const list = reactionMap.get(r.commentId!) ?? [];
      list.push(r);
      reactionMap.set(r.commentId!, list);
    }

    return comments.map((comment) => {
      const commentReactions = reactionMap.get(comment.id) ?? [];
      const counts: Record<ReactionType, number> = { like: 0, love: 0, wow: 0 };
      for (const r of commentReactions) counts[r.type] += 1;
      const myReaction = currentUserId
        ? commentReactions.find((r) => r.ownerId === currentUserId)?.type ?? null
        : null;

      return {
        ...comment,
        ownerAvatarUrl: avatarMap.get(comment.ownerId) ?? null,
        reactions: { counts, total: commentReactions.length, my: myReaction },
      };
    });
  }

  async findByOwner(
    ownerId: number,
    options: { limit?: number; offset?: number } = {},
    viewerId?: number,
  ): Promise<{ comments: any[]; total: number; hasMore: boolean }> {
    const viewer = viewerId
      ? await this.userRepository.findOne({ where: { userId: viewerId } })
      : null;
    const hasAllAccess = !!viewer &&
      (viewer.role === Role.SuperAdmin ||
        viewer.role === Role.Moderator ||
        viewer.allDepartmentsAccess === true);
    const limit = Math.min(options.limit ?? 30, 100);
    const offset = options.offset ?? 0;

    const query = this.commentRepository
      .createQueryBuilder('comment')
      .innerJoin(Post, 'post', 'post.id = comment.postId')
      .where('comment.ownerId = :ownerId', { ownerId });

    if (!hasAllAccess) {
      if (viewer?.departmentId) {
        query.andWhere(
          '(post.departmentId IS NULL OR post.departmentId = :departmentId)',
          { departmentId: viewer.departmentId },
        );
      } else {
        query.andWhere('post.departmentId IS NULL');
      }
    }

    const [comments, total] = await Promise.all([
      query.clone()
        .orderBy('comment.createdAt', 'DESC')
        .skip(offset)
        .take(limit)
        .getMany(),
      query.clone().getCount(),
    ]);

    if (comments.length === 0) {
      return { comments: [], total, hasMore: false };
    }

    const commentIds = comments.map((comment) => comment.id);
    const postIds = [...new Set(comments.map((comment) => comment.postId))];
    const [posts, reactions] = await Promise.all([
      this.postRepository.find({ where: { id: In(postIds) } }),
      this.reactionRepository.find({ where: { commentId: In(commentIds) } }),
    ]);
    const postMap = new Map(posts.map((post) => [post.id, post]));
    const reactionMap = new Map<number, Reaction[]>();
    for (const reaction of reactions) {
      const list = reactionMap.get(reaction.commentId!) ?? [];
      list.push(reaction);
      reactionMap.set(reaction.commentId!, list);
    }

    return {
      comments: comments.map((comment) => {
        const commentReactions = reactionMap.get(comment.id) ?? [];
        const counts: Record<ReactionType, number> = { like: 0, love: 0, wow: 0 };
        for (const reaction of commentReactions) counts[reaction.type] += 1;
        const post = postMap.get(comment.postId);

        return {
          ...comment,
          post: post
            ? {
                id: post.id,
                title: post.title,
                ownerId: post.ownerId,
                ownerUsername: post.ownerUsername,
                createdAt: post.createdAt,
              }
            : null,
          reactions: {
            counts,
            total: commentReactions.length,
            my: viewerId
              ? commentReactions.find((reaction) => reaction.ownerId === viewerId)?.type ?? null
              : null,
          },
        };
      }),
      total,
      hasMore: offset + comments.length < total,
    };
  }

  async findOne(id: number): Promise<Comment | null> {
    return this.commentRepository.findOne({ where: { id } });
  }

  async create(
    actor: { userId: number; username: string },
    postId: number,
    content: string,
  ): Promise<Comment | null> {
    const post = await this.postsService.findOne(postId);
    if (!post) return null;

    const comment = this.commentRepository.create({
      ownerId: actor.userId,
      ownerUsername: actor.username,
      postId,
      content,
    });
    const saved = await this.commentRepository.save(comment);

    if (post.ownerId !== actor.userId) {
      await this.notificationsService.create({
        recipientId: post.ownerId,
        actorId: actor.userId,
        actorUsername: actor.username,
        type: NotificationType.Comment,
        content: `${actor.username} commented on your post "${post.title}"`,
        postId,
        commentId: saved.id,
      });
    }

    await this.activityLogService.log({
      userId: actor.userId,
      username: actor.username,
      action: ActivityAction.CommentCreated,
      detail: `Commented on post #${postId}`,
    });

    return saved;
  }

  async delete(id: number): Promise<boolean> {
    await this.reactionRepository.delete({ commentId: id });
    const result = await this.commentRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
