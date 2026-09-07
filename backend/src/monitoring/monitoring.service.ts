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
    // SINGLE optimized query using subqueries - avoids N+1 and IN clause bloat
    // Computes post/comment/reaction counts directly in SQL
    const topUsersQuery = `
      SELECT
        u.userId,
        u.username,
        u.fullName,
        u.avatarUrl,
        u.departmentId,
        COALESCE(p.postCount, 0) AS posts,
        COALESCE(c.commentCount, 0) AS comments,
        COALESCE(r.reactionCount, 0) AS reactions,
        (COALESCE(p.postCount, 0) * 3 + COALESCE(c.commentCount, 0) * 2 + COALESCE(r.reactionCount, 0)) AS engagement
      FROM users u
      LEFT JOIN (
        SELECT ownerId, COUNT(*) AS postCount
        FROM posts
        GROUP BY ownerId
      ) p ON u.userId = p.ownerId
      LEFT JOIN (
        SELECT ownerId, COUNT(*) AS commentCount
        FROM comments
        GROUP BY ownerId
      ) c ON u.userId = c.ownerId
      LEFT JOIN (
        SELECT ownerId, COUNT(*) AS reactionCount
        FROM reactions
        GROUP BY ownerId
      ) r ON u.userId = r.ownerId
      WHERE u.isActive = true
      ORDER BY engagement DESC
      LIMIT :limit
    `;

    const result = await this.userRepository
      .createQueryBuilder('u')
      .select(topUsersQuery)
      .setParameter('limit', limit)
      .getRawMany();

    return result.map((row: any) => ({
      userId: row.userId,
      username: row.username,
      fullName: row.fullName,
      avatarUrl: row.avatarUrl,
      departmentId: row.departmentId,
      posts: row.posts,
      comments: row.comments,
      reactions: row.reactions,
      engagement: row.engagement,
    }));
  }
}
