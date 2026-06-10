import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getPosts() {
    return this.postsService.findAll();
  }

  @Get(':id')
  async getPost(@Param('id', ParseIntPipe) id: number) {
    const post = await this.postsService.findOne(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator, Role.RegularUser)
  @Post()
  async createPost(@Request() req: any, @Body() body: CreatePostDto) {
    return this.postsService.create(req.user.userId, req.user.username, body.title, body.content);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updatePost(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePostDto,
  ) {
    const post = await this.postsService.findOne(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.ownerId !== req.user.userId && req.user.role !== Role.SuperAdmin) {
      throw new ForbiddenException('You can only update your own post');
    }
    const title = body.title ?? post.title;
    const content = body.content ?? post.content;
    return this.postsService.update(id, title, content);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deletePost(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    const post = await this.postsService.findOne(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    const isOwner = post.ownerId === req.user.userId;
    const isModerator = req.user.role === Role.Moderator || req.user.role === Role.SuperAdmin;
    if (!isOwner && !isModerator) {
      throw new ForbiddenException('You can only delete your own post');
    }
    const removed = await this.postsService.delete(id);
    return { success: removed };
  }
}
