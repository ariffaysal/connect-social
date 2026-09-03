import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { MonitoringService } from './monitoring.service';
import { ActivityLogService } from './activity-log.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Get('overview')
  overview() {
    return this.monitoringService.overview();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Get('timeline')
  timeline(@Query('days') days?: string) {
    return this.monitoringService.timeline(days ? parseInt(days, 10) : 7);
  }

  // Leaderboard: readable by every authenticated user (feed sidebar).
  @Get('top-users')
  topUsers(@Query('limit') limit?: string) {
    return this.monitoringService.topUsers(limit ? parseInt(limit, 10) : 10);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Get('activity')
  activity(@Query('limit') limit?: string) {
    return this.activityLogService.recent(limit ? parseInt(limit, 10) : 50);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Get('activity/user/:id')
  userActivity(@Param('id', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    return this.activityLogService.forUser(id, limit ? parseInt(limit, 10) : 50);
  }
}
