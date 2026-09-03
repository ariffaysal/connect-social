import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { DepartmentsModule } from './departments/departments.module';
import { ReactionsModule } from './reactions/reactions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { UploadsModule } from './uploads/uploads.module';
import { RealtimeModule } from './realtime/realtime.module';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';
import { Comment } from './comments/entities/comment.entity';
import { Department } from './departments/entities/department.entity';
import { Reaction } from './reactions/entities/reaction.entity';
import { Notification } from './notifications/entities/notification.entity';
import { Report } from './reports/entities/report.entity';
import { ActivityLog } from './monitoring/entities/activity-log.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3307,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'connect_social',
      entities: [User, Post, Comment, Department, Reaction, Notification, Report, ActivityLog],
      // Auto-creates tables while developing. Disable (`false`) in production
      // and use migrations instead.
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      // Test-only: wipe and recreate the schema on boot for clean isolation
      // (defaults to off outside the jest suite).
      dropSchema: process.env.DB_DROP_SCHEMA === 'true',
    }),
    // Loose global default; stricter limits are applied per route
    // (login, report creation) with the @Throttle decorator.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    DepartmentsModule,
    ReactionsModule,
    NotificationsModule,
    ReportsModule,
    MonitoringModule,
    UploadsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
