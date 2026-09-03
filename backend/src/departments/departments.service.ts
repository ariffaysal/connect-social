import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../auth/roles.enum';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<Department[]> {
    return this.departmentRepository.find({ order: { name: 'ASC' } });
  }

  /**
   * Departments visible to a user. SuperAdmins, Moderators and users with
   * all-departments access see every group; other users only see the group
   * they belong to.
   */
  async findAllForUser(userId?: number): Promise<Department[]> {
    if (!userId) return [];
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) return [];
    const hasAllAccess =
      user.role === Role.SuperAdmin ||
      user.role === Role.Moderator ||
      user.allDepartmentsAccess === true;
    if (hasAllAccess) {
      return this.findAll();
    }
    if (!user.departmentId) return [];
    const dept = await this.departmentRepository.findOne({
      where: { id: user.departmentId },
    });
    return dept ? [dept] : [];
  }

  async findOne(id: number): Promise<Department | null> {
    return this.departmentRepository.findOne({ where: { id } });
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    return this.departmentRepository.save(this.departmentRepository.create(dto));
  }

  async update(id: number, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findOne(id);
    if (!department) throw new NotFoundException('Department not found');
    await this.departmentRepository.update(id, dto);
    return (await this.findOne(id))!;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.departmentRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
