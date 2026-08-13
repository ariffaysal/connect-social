import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../auth/roles.enum';
import { Department } from '../departments/entities/department.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Reaction } from '../reactions/entities/reaction.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
  ) {}

  async onModuleInit() {
    const defaultUsers = [
      {
        username: 'admin',
        password: 'password',
        role: Role.SuperAdmin,
        fullName: 'Alex Morgan',
        jobTitle: 'Chief Operating Officer',
        email: 'admin@company.com',
      },
      {
        username: 'moderator',
        password: 'password',
        role: Role.Moderator,
        fullName: 'Sam Patel',
        jobTitle: 'Community Manager',
        email: 'moderator@company.com',
      },
      {
        username: 'user',
        password: 'password',
        role: Role.RegularUser,
        fullName: 'Jordan Lee',
        jobTitle: 'Software Engineer',
        email: 'user@company.com',
      },
      {
        username: 'guest',
        password: 'guest123',
        role: Role.Guest,
        fullName: 'Guest Visitor',
        jobTitle: 'External Partner',
        email: 'guest@company.com',
      },
    ];

    for (const u of defaultUsers) {
      const existing = await this.userRepository.findOne({ where: { username: u.username } });
      if (!existing) {
        const newUser = this.userRepository.create(u);
        await this.userRepository.save(newUser);
      }
    }

    const defaultDepartments = [
      { name: 'Engineering', color: '#6366f1', description: 'Builders of our products' },
      { name: 'Marketing', color: '#ec4899', description: 'Brand, growth and outreach' },
      { name: 'Sales', color: '#f59e0b', description: 'Revenue and customer success' },
      { name: 'Human Resources', color: '#10b981', description: 'People operations and culture' },
      { name: 'Finance', color: '#0ea5e9', description: 'Budget, accounting and payroll' },
    ];

    for (const d of defaultDepartments) {
      const existing = await this.departmentRepository.findOne({ where: { name: d.name } });
      if (!existing) {
        await this.departmentRepository.save(this.departmentRepository.create(d));
      }
    }
  }

  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find({ order: { createdAt: 'ASC' } });
    return this.attachStats(users);
  }

  async findOne(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async findById(userId: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { userId } });
  }

  async create(userDto: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userDto);
    return this.userRepository.save(user);
  }

  async update(userId: number, partial: Partial<User>): Promise<User | null> {
    await this.userRepository.update(userId, partial);
    return this.findById(userId);
  }

  async getUserProfile(userId: number): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) return null;

    const postCount = await this.postRepository.count({ where: { ownerId: userId } });
    const commentCount = await this.commentRepository.count({ where: { ownerId: userId } });
    const reactionCount = await this.reactionRepository.count({ where: { ownerId: userId } });

    const [postIds, commentIds] = await Promise.all([
      this.postRepository.find({ where: { ownerId: userId }, select: { id: true } }),
      this.commentRepository.find({ where: { ownerId: userId }, select: { id: true } }),
    ]);
    const ownedPostIds = postIds.map((p) => p.id);
    const ownedCommentIds = commentIds.map((c) => c.id);
    const receivedReactions =
      ownedPostIds.length === 0 && ownedCommentIds.length === 0
        ? 0
        : this.reactionRepository
            .createQueryBuilder('r')
            .where(
              ownedPostIds.length > 0 && ownedCommentIds.length > 0
                ? '(r.postId IN (:...postIds) OR r.commentId IN (:...commentIds))'
                : ownedPostIds.length > 0
                  ? 'r.postId IN (:...postIds)'
                  : 'r.commentId IN (:...commentIds)',
              {
                postIds: ownedPostIds,
                commentIds: ownedCommentIds,
              },
            )
            .getCount();
    const department = user.departmentId
      ? await this.departmentRepository.findOne({ where: { id: user.departmentId } })
      : null;

    return {
      ...user,
      postCount,
      commentCount,
      reactionCount,
      receivedReactions,
      departmentName: department?.name,
      departmentColor: department?.color,
    } as User;
  }

  private async attachStats(users: User[]) {
    const ids = users.map((u) => u.userId);
    if (ids.length === 0) return users;

    const [postCounts, commentCounts, departments] = await Promise.all([
      this.postRepository
        .createQueryBuilder('p')
        .select('p.ownerId', 'ownerId')
        .addSelect('COUNT(p.id)', 'cnt')
        .where('p.ownerId IN (:...ids)', { ids })
        .groupBy('p.ownerId')
        .getRawMany(),
      this.commentRepository
        .createQueryBuilder('c')
        .select('c.ownerId', 'ownerId')
        .addSelect('COUNT(c.id)', 'cnt')
        .where('c.ownerId IN (:...ids)', { ids })
        .groupBy('c.ownerId')
        .getRawMany(),
      this.departmentRepository.find(),
    ]);

    const postMap = new Map(postCounts.map((r: any) => [Number(r.ownerId), Number(r.cnt)]));
    const commentMap = new Map(commentCounts.map((r: any) => [Number(r.ownerId), Number(r.cnt)]));
    const deptMap = new Map(departments.map((d) => [d.id, d]));

    return users.map((u) => ({
      ...u,
      postCount: postMap.get(u.userId) ?? 0,
      commentCount: commentMap.get(u.userId) ?? 0,
      departmentName: u.departmentId ? deptMap.get(u.departmentId)?.name : null,
      departmentColor: u.departmentId ? deptMap.get(u.departmentId)?.color : null,
    }));
  }
}
