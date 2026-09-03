import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Reaction } from '../reactions/entities/reaction.entity';
import { Report, ReportStatus } from '../reports/entities/report.entity';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
  ) {}

  async overview() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeToday,
      posts,
      comments,
      reactions,
      pendingReports,
      newUsersWeek,
      postsWeek,
      commentsWeek,
      reactionsWeek,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository
        .createQueryBuilder('u')
        .where('u.lastSeenAt >= :since', { since: todayStart.toISOString() })
        .getCount(),
      this.postRepository.count(),
      this.commentRepository.count(),
      this.reactionRepository.count(),
      this.reportRepository.count({ where: { status: ReportStatus.Pending } }),
      this.userRepository
        .createQueryBuilder('u')
        .where('u.createdAt >= :since', { since: weekAgo.toISOString() })
        .getCount(),
      this.postRepository
        .createQueryBuilder('p')
        .where('p.createdAt >= :since', { since: weekAgo.toISOString() })
        .getCount(),
      this.commentRepository
        .createQueryBuilder('c')
        .where('c.createdAt >= :since', { since: weekAgo.toISOString() })
        .getCount(),
      this.reactionRepository
        .createQueryBuilder('r')
        .where('r.createdAt >= :since', { since: weekAgo.toISOString() })
        .getCount(),
    ]);

    // Active users last 24h: distinct users who logged in or created content
    const activeSince = await this.userRepository
      .createQueryBuilder('u')
      .where('u.lastSeenAt >= :since', { since: dayAgo.toISOString() })
      .orWhere('u.lastLoginAt >= :since', { since: dayAgo.toISOString() })
      .getCount();

    return {
      totalUsers,
      activeToday,
      activeSince24h: activeSince,
      totalPosts: posts,
      totalComments: comments,
      totalReactions: reactions,
      pendingReports,
      newUsersWeek,
      postsWeek,
      commentsWeek,
      reactionsWeek,
      snapshot: {
        postsWeek,
        commentsWeek,
        reactionsWeek,
      },
    };
  }

  async timeline(days = 7) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [postRows, commentRows, loginRows] = await Promise.all([
      this.postRepository
        .createQueryBuilder('p')
        .select("DATE_FORMAT(p.createdAt, '%Y-%m-%d')", 'day')
        .addSelect('COUNT(p.id)', 'cnt')
        .where('p.createdAt >= :start', { start })
        .groupBy('day')
        .getRawMany(),
      this.commentRepository
        .createQueryBuilder('c')
        .select("DATE_FORMAT(c.createdAt, '%Y-%m-%d')", 'day')
        .addSelect('COUNT(c.id)', 'cnt')
        .where('c.createdAt >= :start', { start })
        .groupBy('day')
        .getRawMany(),
      this.userRepository
        .createQueryBuilder('u')
        .select("DATE_FORMAT(u.lastLoginAt, '%Y-%m-%d')", 'day')
        .addSelect('COUNT(u.userId)', 'cnt')
        .where('u.lastLoginAt >= :start', { start })
        .groupBy('day')
        .getRawMany(),
    ]);

    const postMap = new Map(postRows.map((r: any) => [r.day, Number(r.cnt)]));
    const commentMap = new Map(commentRows.map((r: any) => [r.day, Number(r.cnt)]));
    const loginMap = new Map(loginRows.map((r: any) => [r.day, Number(r.cnt)]));

    const result: { day: string; posts: number; comments: number; logins: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      result.push({
        day: key,
        posts: postMap.get(key) ?? 0,
        comments: commentMap.get(key) ?? 0,
        logins: loginMap.get(key) ?? 0,
      });
    }
    return result;
  }

  async topUsers(limit = 10) {
    const users = await this.userRepository.find({ where: { isActive: true } });
    const userIds = users.map((u) => u.userId);
    if (userIds.length === 0) return [];

    const [posts, comments, reactions] = await Promise.all([
      this.postRepository
        .createQueryBuilder('p')
        .select('p.ownerId', 'ownerId')
        .addSelect('COUNT(p.id)', 'cnt')
        .where('p.ownerId IN (:...ids)', { ids: userIds })
        .groupBy('p.ownerId')
        .getRawMany(),
      this.commentRepository
        .createQueryBuilder('c')
        .select('c.ownerId', 'ownerId')
        .addSelect('COUNT(c.id)', 'cnt')
        .where('c.ownerId IN (:...ids)', { ids: userIds })
        .groupBy('c.ownerId')
        .getRawMany(),
      this.reactionRepository
        .createQueryBuilder('r')
        .select('r.ownerId', 'ownerId')
        .addSelect('COUNT(r.id)', 'cnt')
        .where('r.ownerId IN (:...ids)', { ids: userIds })
        .groupBy('r.ownerId')
        .getRawMany(),
    ]);

    const postMap = new Map(posts.map((r: any) => [Number(r.ownerId), Number(r.cnt)]));
    const commentMap = new Map(comments.map((r: any) => [Number(r.ownerId), Number(r.cnt)]));
    const reactionMap = new Map(reactions.map((r: any) => [Number(r.ownerId), Number(r.cnt)]));

    return users
      .map((u) => ({
        userId: u.userId,
        username: u.username,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl,
        departmentId: u.departmentId,
        posts: postMap.get(u.userId) ?? 0,
        comments: commentMap.get(u.userId) ?? 0,
        reactions: reactionMap.get(u.userId) ?? 0,
        engagement: (postMap.get(u.userId) ?? 0) * 3 + (commentMap.get(u.userId) ?? 0) * 2 + (reactionMap.get(u.userId) ?? 0),
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit);
  }
}
