import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportStatus } from './entities/report.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateReportDto) {
    const report = await this.reportsService.create(
      { userId: req.user.userId, username: req.user.username },
      dto,
    );
    await this.activityLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: ActivityAction.ReportFiled,
      detail: `Reported ${dto.targetType} #${dto.targetId}`,
    });
    return report;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator)
  @Get()
  async findAll(@Query('status') status?: string) {
    const statusEnum = status === ReportStatus.Resolved || status === ReportStatus.Dismissed
      ? (status as ReportStatus)
      : status
        ? (status as ReportStatus)
        : undefined;
    const reports = await this.reportsService.findAll(statusEnum);
    return this.reportsService.enrich(reports);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator)
  @Patch(':id/resolve')
  async resolve(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { deleteTarget?: boolean },
  ) {
    const report = await this.reportsService.resolve(id, req.user.userId, !!body?.deleteTarget);
    await this.activityLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: ActivityAction.Moderation,
      detail: `Resolved report #${id}${body?.deleteTarget ? ' and removed target' : ''}`,
    });
    return report;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator)
  @Patch(':id/dismiss')
  async dismiss(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const report = await this.reportsService.dismiss(id, req.user.userId);
    await this.activityLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: ActivityAction.Moderation,
      detail: `Dismissed report #${id}`,
    });
    return report;
  }
}
