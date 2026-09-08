import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Reaction, ReactionType } from './entities/reaction.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../auth/roles.enum';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../comments/comments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async togglePostReaction(
    actor: { userId: number; username: string },
    postId: number,
    type: ReactionType,
  ) {
    const post = await this.postsService.findOne(postId);
    if (!post) return { reacted: false, error: 'Post not found' };

    const existing = await this.reactionRepository.findOne({
      where: { ownerId: actor.userId, postId },
    });

    if (existing) {
      if (existing.type === type) {
        await this.reactionRepository.delete(existing.id);
        return { reacted: false, type: null, removed: true };
      }
      existing.type = type;
      await this.reactionRepository.save(existing);
      return { reacted: true, type, updated: true };
    }

    const reaction = this.reactionRepository.create({
      ownerId: actor.userId,
      ownerUsername: actor.username,
      type,
      postId,
    });
    await this.reactionRepository.save(reaction);

    if (post.ownerId !== actor.userId) {
      await this.notificationsService.create({
        recipientId: post.ownerId,
        actorId: actor.userId,
        actorUsername: actor.username,
        type: NotificationType.Reaction,
        content: `${actor.username} reacted ${type} to your post "${post.title}"`,
        postId: post.id,
      });
    }

    await this.activityLogService.log({
      userId: actor.userId,
      username: actor.username,
      action: ActivityAction.ReactionAdded,
      detail: `${type} on post #${postId}`,
    });

    return { reacted: true, type };
  }

  async toggleCommentReaction(
    actor: { userId: number; username: string },
    commentId: number,
    type: ReactionType,
  ) {
    const comment = await this.commentsService.findOne(commentId);
    if (!comment) return { reacted: false, error: 'Comment not found' };

    const existing = await this.reactionRepository.findOne({
      where: { ownerId: actor.userId, commentId },
    });

    if (existing) {
      if (existing.type === type) {
        await this.reactionRepository.delete(existing.id);
        return { reacted: false, type: null, removed: true };
      }
      existing.type = type;
      await this.reactionRepository.save(existing);
      return { reacted: true, type, updated: true };
    }

    const reaction = this.reactionRepository.create({
      ownerId: actor.userId,
      ownerUsername: actor.username,
      type,
      commentId,
    });
    await this.reactionRepository.save(reaction);

    if (comment.ownerId !== actor.userId) {
      await this.notificationsService.create({
        recipientId: comment.ownerId,
        actorId: actor.userId,
        actorUsername: actor.username,
        type: NotificationType.Reaction,
        content: `${actor.username} reacted ${type} to your comment on post #${comment.postId}`,
        postId: comment.postId,
        commentId: comment.id,
      });
    }

    await this.activityLogService.log({
      userId: actor.userId,
      username: actor.username,
      action: ActivityAction.ReactionAdded,
      detail: `${type} on comment #${commentId}`,
    });

    return { reacted: true, type };
  }

  async summary(postId?: number, commentId?: number, userId?: number) {
    const reactions = await this.reactionRepository.find({
      where: postId ? { postId } : { commentId },
    });
    const counts: Record<ReactionType, number> = { like: 0, love: 0, wow: 0 };
    for (const r of reactions) {
      counts[r.type] += 1;
    }
    const my = userId
      ? await this.reactionRepository.findOne({
          where: userId && postId
            ? { ownerId: userId, postId }
            : { ownerId: userId, commentId },
        })
      : null;

    return {
      counts,
      total: reactions.length,
      my: my ? my.type : null,
    };
  }

  async findByOwner(
    ownerId: number,
    options: { limit?: number; offset?: number } = {},
    viewerId?: number,
  ): Promise<{ reactions: any[]; total: number; hasMore: boolean }> {
    const viewer = viewerId
      ? await this.userRepository.findOne({ where: { userId: viewerId } })
      : null;
    const hasAllAccess = !!viewer &&
      (viewer.role === Role.SuperAdmin ||
        viewer.role === Role.Moderator ||
        viewer.allDepartmentsAccess === true);
    const limit = Math.min(options.limit ?? 30, 100);
    const offset = options.offset ?? 0;

    const query = this.reactionRepository
      .createQueryBuilder('reaction')
      .leftJoin(Post, 'post', 'post.id = reaction.postId')
      .leftJoin(Comment, 'comment', 'comment.id = reaction.commentId')
      .leftJoin(Post, 'commentPost', 'commentPost.id = comment.postId')
      .where('reaction.ownerId = :ownerId', { ownerId });

    if (!hasAllAccess) {
      if (viewer?.departmentId) {
        query.andWhere(
          `((reaction.postId IS NOT NULL AND (post.departmentId IS NULL OR post.departmentId = :departmentId))
            OR (reaction.commentId IS NOT NULL AND (commentPost.departmentId IS NULL OR commentPost.departmentId = :departmentId))`,
          { departmentId: viewer.departmentId },
        );
      } else {
        query.andWhere(
          `((reaction.postId IS NOT NULL AND post.departmentId IS NULL)
            OR (reaction.commentId IS NOT NULL AND commentPost.departmentId IS NULL))`,
        );
      }
    }

    const [reactions, total] = await Promise.all([
      query.clone()
        .orderBy('reaction.createdAt', 'DESC')
        .skip(offset)
        .take(limit)
        .getMany(),
      query.clone().getCount(),
    ]);

    if (reactions.length === 0) {
      return { reactions: [], total, hasMore: false };
    }

    const postIds = reactions
      .filter((reaction) => reaction.postId !== undefined)
      .map((reaction) => reaction.postId!);
    const commentIds = reactions
      .filter((reaction) => reaction.commentId !== undefined)
      .map((reaction) => reaction.commentId!);
    const [posts, comments] = await Promise.all([
      this.postRepository.find({ where: { id: In(postIds) } }),
      this.commentRepository.find({ where: { id: In(commentIds) } }),
    ]);
    const commentPostIds = comments.map((comment) => comment.postId);
    const parentPosts = commentPostIds.length > 0
      ? await this.postRepository.find({ where: { id: In(commentPostIds) } })
      : [];
    const postMap = new Map([...posts, ...parentPosts].map((post) => [post.id, post]));
    const commentMap = new Map(comments.map((comment) => [comment.id, comment]));

    return {
      reactions: reactions.map((reaction) => {
        const comment = reaction.commentId ? commentMap.get(reaction.commentId) : null;
        const post = reaction.postId
          ? postMap.get(reaction.postId)
          : comment
            ? postMap.get(comment.postId)
            : undefined;

        return {
          ...reaction,
          targetType: reaction.postId ? 'post' : 'comment',
          post: post
            ? {
                id: post.id,
                title: post.title,
                ownerId: post.ownerId,
                ownerUsername: post.ownerUsername,
                createdAt: post.createdAt,
              }
            : null,
          comment: comment
            ? {
                id: comment.id,
                content: comment.content,
                postId: comment.postId,
                ownerId: comment.ownerId,
                ownerUsername: comment.ownerUsername,
                createdAt: comment.createdAt,
              }
            : null,
        };
      }),
      total,
      hasMore: offset + reactions.length < total,
    };
  }
}
