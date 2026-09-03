import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reaction, ReactionType } from './entities/reaction.entity';
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
}
