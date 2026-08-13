import { Controller, Get, Param, ParseIntPipe, Patch, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Request() req: any) {
    return this.notificationsService.forUser(req.user.userId);
  }

  @Get('unread-count')
  unreadCount(@Request() req: any) {
    return this.notificationsService.unreadCount(req.user.userId);
  }

  @Patch(':id/read')
  async markRead(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const ok = await this.notificationsService.markRead(id, req.user.userId);
    return { success: ok };
  }

  @Patch('read-all')
  async markAllRead(@Request() req: any) {
    await this.notificationsService.markAllRead(req.user.userId);
    return { success: true };
  }
}
