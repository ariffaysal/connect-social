import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Reaction, ReactionType } from '../reactions/entities/reaction.entity';
import { PostsService } from '../posts/posts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
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
        reactions: { counts, total: commentReactions.length, my: myReaction },
      };
    });
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
