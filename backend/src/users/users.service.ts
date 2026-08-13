import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../auth/roles.enum';
import { Department } from '../departments/entities/department.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Reaction, ReactionType } from '../reactions/entities/reaction.entity';

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

    await this.seedDemoContent();
  }

  /**
   * Seed a small set of demo posts/comments/reactions so a fresh database
   * shows a populated feed. Only runs when there are no posts yet.
   */
  private async seedDemoContent() {
    const existingPosts = await this.postRepository.count();
    if (existingPosts > 0) return;

    const [admin, moderator, user, guest, engineering, marketing, sales] = await Promise.all([
      this.userRepository.findOne({ where: { username: 'admin' } }),
      this.userRepository.findOne({ where: { username: 'moderator' } }),
      this.userRepository.findOne({ where: { username: 'user' } }),
      this.userRepository.findOne({ where: { username: 'guest' } }),
      this.departmentRepository.findOne({ where: { name: 'Engineering' } }),
      this.departmentRepository.findOne({ where: { name: 'Marketing' } }),
      this.departmentRepository.findOne({ where: { name: 'Sales' } }),
    ]);

    if (!admin || !moderator || !user || !guest) return;

    const samplePosts = [
      {
        owner: admin,
        title: 'Welcome to ConnectSocial 🎉',
        content:
          'Welcome everyone to our new internal social platform! This is a space to share company updates, celebrate wins, and stay connected with your colleagues.\n\nPost updates, react to your teammates’ content, and keep the conversation going. If you see something that needs attention, use the Report button and our moderators will take care of it.',
        imageUrl:
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80',
        departmentId: undefined,
      },
      {
        owner: user,
        title: 'Shipping the new dashboard 🚀',
        content:
          'After months of hard work, the new analytics dashboard is finally live! Users can now see real-time metrics, export reports, and customize their widgets.\n\nSpecial thanks to the whole team for the late nights and the incredible attention to detail. So proud of what we built together!',
        imageUrl:
          'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
        departmentId: engineering?.id,
      },
      {
        owner: moderator,
        title: 'Q3 marketing review is scheduled',
        content:
          'Reminder: our Q3 marketing review is scheduled for Thursday at 2pm in the main conference room (and on Zoom for remote teammates).\n\nWe’ll go over campaign performance, upcoming launches, and next quarter’s priorities. Please bring your updates!',
        imageUrl: undefined,
        departmentId: marketing?.id,
      },
      {
        owner: user,
        title: 'Quarterly sales target update',
        content:
          'Great news everyone — we hit 112% of our quarterly sales target! 🎉\n\nThanks to the entire sales team for an incredible push, and to everyone across the company who supported us along the way.',
        imageUrl: undefined,
        departmentId: sales?.id,
      },
    ];

    const savedPosts: Post[] = [];
    for (const sample of samplePosts) {
      const post = await this.postRepository.save(
        this.postRepository.create({
          ownerId: sample.owner.userId,
          ownerUsername: sample.owner.username,
          title: sample.title,
          content: sample.content,
          imageUrl: sample.imageUrl,
          departmentId: sample.departmentId,
        }),
      );
      savedPosts.push(post);
    }

    // A few comments across the posts
    const sampleComments = [
      { post: savedPosts[0], owner: user, content: 'This is awesome! Welcome everyone 👋' },
      { post: savedPosts[0], owner: moderator, content: 'Glad to have everyone here!' },
      { post: savedPosts[1], owner: admin, content: 'Incredible work, team! 🎉' },
      { post: savedPosts[1], owner: moderator, content: 'The dashboard looks stunning.' },
      { post: savedPosts[2], owner: admin, content: 'I’ll be there, thanks for the reminder!' },
      { post: savedPosts[3], owner: admin, content: 'Huge milestone, congrats sales team!' },
    ];

    const savedComments: Comment[] = [];
    for (const sample of sampleComments) {
      if (!sample.post) continue;
      const comment = await this.commentRepository.save(
        this.commentRepository.create({
          postId: sample.post.id,
          ownerId: sample.owner.userId,
          ownerUsername: sample.owner.username,
          content: sample.content,
        }),
      );
      savedComments.push(comment);
    }

    // Some reactions (like/love/wow) sprinkled across posts and comments
    const reactionSeed: { type: ReactionType; owner: User; postId?: number; commentId?: number }[] = [
      { type: ReactionType.Like, owner: admin, postId: savedPosts[1]?.id },
      { type: ReactionType.Love, owner: moderator, postId: savedPosts[1]?.id },
      { type: ReactionType.Like, owner: user, postId: savedPosts[2]?.id },
      { type: ReactionType.Love, owner: user, postId: savedPosts[3]?.id },
      { type: ReactionType.Like, owner: guest, postId: savedPosts[0]?.id },
      { type: ReactionType.Wow, owner: user, commentId: savedComments[2]?.id },
      { type: ReactionType.Like, owner: admin, commentId: savedComments[4]?.id },
    ];

    for (const r of reactionSeed) {
      if (r.postId === undefined && r.commentId === undefined) continue;
      await this.reactionRepository.save(
        this.reactionRepository.create({
          type: r.type,
          ownerId: r.owner.userId,
          ownerUsername: r.owner.username,
          postId: r.postId,
          commentId: r.commentId,
        }),
      );
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
