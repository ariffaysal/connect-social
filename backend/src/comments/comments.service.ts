import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async findByPost(postId: number): Promise<Comment[]> {
    return this.commentRepository.find({ where: { postId }, order: { createdAt: 'ASC' } });
  }

  async findOne(id: number): Promise<Comment | null> {
    return this.commentRepository.findOne({ where: { id } });
  }

  async create(ownerId: number, ownerUsername: string, postId: number, content: string): Promise<Comment> {
    const comment = this.commentRepository.create({ ownerId, ownerUsername, postId, content });
    return this.commentRepository.save(comment);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.commentRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
