import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('posts/:id/react')
  reactToPost(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReactionDto,
  ) {
    return this.reactionsService.togglePostReaction(
      { userId: req.user.userId, username: req.user.username },
      id,
      dto.type,
    );
  }

  @Post('comments/:id/react')
  reactToComment(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateReactionDto,
  ) {
    return this.reactionsService.toggleCommentReaction(
      { userId: req.user.userId, username: req.user.username },
      id,
      dto.type,
    );
  }

  @Get('posts/:id/reactions')
  postSummary(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.reactionsService.summary(id, undefined, req.user.userId);
  }

  @Get('comments/:id/reactions')
  commentSummary(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.reactionsService.summary(undefined, id, req.user.userId);
  }
}
