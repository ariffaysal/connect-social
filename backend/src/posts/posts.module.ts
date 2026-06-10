import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { AuthModule } from '../auth/auth.module';
import { Post } from './entities/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), AuthModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
