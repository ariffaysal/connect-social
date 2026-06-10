import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { AuthModule } from '../auth/auth.module';
import { PostsModule } from '../posts/posts.module';
import { Comment } from './entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment]), AuthModule, PostsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
