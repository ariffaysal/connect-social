import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportStatus, ReportTargetType } from './entities/report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from '../comments/comments.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
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
    return Promise.all(
      reports.map(async (report) => {
        let target: any = null;
        if (report.targetType === ReportTargetType.Post) {
          target = await this.postsService.findOne(report.targetId);
        } else {
          const comment = await this.commentsService.findOne(report.targetId);
          if (comment) {
            target = { ...comment, post: await this.postsService.findOne(comment.postId) };
          }
        }
        return { ...report, target };
      }),
    );
  }
}
