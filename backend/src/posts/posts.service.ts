import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async findAll(): Promise<Post[]> {
    return this.postRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Post | null> {
    return this.postRepository.findOne({ where: { id } });
  }

  async create(ownerId: number, ownerUsername: string, title: string, content: string): Promise<Post> {
    const post = this.postRepository.create({ ownerId, ownerUsername, title, content });
    return this.postRepository.save(post);
  }

  async update(id: number, title: string, content: string): Promise<Post | null> {
    await this.postRepository.update(id, { title, content });
    return this.findOne(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.postRepository.delete(id);
    return result.affected !== undefined && result.affected > 0;
  }
}
