import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../comments/comments.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {}

  async create(reporter: { userId: number; username: string }, dto: CreateReportDto): Promise<Report> {
    const report = this.reportRepository.create({
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
      reporterId: reporter.userId,
      reporterUsername: reporter.username,
    });
    return this.reportRepository.save(report);
  }

  async findAll(status?: ReportStatus): Promise<Report[]> {
    return this.reportRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async pendingCount(): Promise<number> {
    return this.reportRepository.count({
      where: { status: ReportStatus.Pending },
    });
  }

  async resolve(id: number, resolverId: number, deleteTarget = false): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    if (deleteTarget && report.status === ReportStatus.Pending) {
      if (report.targetType === ReportTargetType.Post) {
        await this.postsService.delete(report.targetId);
      } else {
        await this.commentsService.delete(report.targetId);
      }
    }

    report.status = ReportStatus.Resolved;
    report.resolvedById = resolverId;
    report.resolvedAt = new Date();
    return this.reportRepository.save(report);
  }

  async dismiss(id: number, resolverId: number): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    report.status = ReportStatus.Dismissed;
    report.resolvedById = resolverId;
    report.resolvedAt = new Date();
    return this.reportRepository.save(report);
  }

  async enrich(reports: Report[]): Promise<any[]> {
    if (reports.length === 0) return [];

    const postIds = reports
      .filter((report) => report.targetType === ReportTargetType.Post)
      .map((report) => report.targetId);
    const commentIds = reports
      .filter((report) => report.targetType === ReportTargetType.Comment)
      .map((report) => report.targetId);
    const [posts, comments] = await Promise.all([
      postIds.length > 0 ? this.postRepository.find({ where: { id: In(postIds) } }) : [],
      commentIds.length > 0 ? this.commentRepository.find({ where: { id: In(commentIds) } }) : [],
    ]);
    const commentPostIds = comments.map((comment) => comment.postId);
    const commentPosts = commentPostIds.length > 0
      ? await this.postRepository.find({ where: { id: In(commentPostIds) } })
      : [];
    const postMap = new Map([...posts, ...commentPosts].map((post) => [post.id, post]));
    const commentMap = new Map(comments.map((comment) => [comment.id, comment]));

    return reports.map((report) => {
      if (report.targetType === ReportTargetType.Post) {
        return { ...report, target: postMap.get(report.targetId) ?? null };
      }

      const comment = commentMap.get(report.targetId);
      return {
        ...report,
        target: comment
          ? { ...comment, post: postMap.get(comment.postId) ?? null }
          : null,
      };
    });
  }
}
