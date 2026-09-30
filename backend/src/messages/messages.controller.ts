import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MessagesService, isAuditEnabled, resolveRetentionMinutes } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** Retention details so the UI can show the one-hour auto-delete notice. */
  @Get('retention')
  retention() {
    return {
      retentionMinutes: resolveRetentionMinutes(),
      auditEnabled: isAuditEnabled(),
    };
  }

  /** Send a direct message to another user. */
  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator, Role.RegularUser)
  @Post()
  send(@Request() req: any, @Body() body: SendMessageDto) {
    return this.messagesService.send(
      { userId: req.user.userId, username: req.user.username },
      body.recipientId,
      body.content,
    );
  }

  /** My conversations (each counterpart + last message), most recent first. */
  @Get('conversations')
  conversations(@Request() req: any) {
    return this.messagesService.conversations(req.user.userId);
  }

  /** The conversation between me and another user. */
  @Get('with/:userId')
  thread(
    @Request() req: any,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.messagesService.threadBetween(req.user.userId, userId, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** Management monitoring: every active conversation on the platform. */
  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator)
  @Get('admin/conversations')
  adminConversations(@Query('limit') limit?: string) {
    return this.messagesService.adminConversations(limit ? Number(limit) : 50);
  }

  /** Management monitoring: the full monitored thread between two users. */
  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator)
  @Get('admin/thread')
  adminThread(
    @Query('userA', ParseIntPipe) userA: number,
    @Query('userB', ParseIntPipe) userB: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.messagesService.adminThread(userA, userB, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
