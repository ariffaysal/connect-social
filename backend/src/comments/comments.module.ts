import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { AuthModule } from '../auth/auth.module';
import { PostsModule } from '../posts/posts.module';
import { Comment } from './entities/comment.entity';
import { Reaction } from '../reactions/entities/reaction.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Reaction]),
    AuthModule,
    PostsModule,
    NotificationsModule,
    MonitoringModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
