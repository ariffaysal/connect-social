import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PostsService } from '../posts/posts.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly postsService: PostsService,
  ) {}

  @Get('posts/:postId/comments')
  async getComments(@Param('postId', ParseIntPipe) postId: number) {
    return this.commentsService.findByPost(postId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator, Role.RegularUser)
  @Post('posts/:postId/comments')
  async createComment(
    @Request() req: any,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: CreateCommentDto,
  ) {
    const comment = await this.commentsService.create(
      req.user.userId,
      req.user.username,
      postId,
      body.content,
    );
    if (!comment) {
      throw new NotFoundException('Post not found');
    }
    return comment;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  async deleteComment(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const comment = await this.commentsService.findOne(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.postsService.findOne(comment.postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const isCommentOwner = comment.ownerId === req.user.userId;
    const isPostOwner = post.ownerId === req.user.userId;
    const isModerator = req.user.role === Role.Moderator || req.user.role === Role.SuperAdmin;

    if (!isCommentOwner && !isPostOwner && !isModerator) {
      throw new ForbiddenException('You are not allowed to delete this comment');
    }

    const removed = await this.commentsService.delete(id);
    return { success: removed };
  }
}
