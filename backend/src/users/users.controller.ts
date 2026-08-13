import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Post()
  async create(@Request() req: any, @Body() userDto: CreateUserDto) {
    const user = await this.usersService.create(userDto);
    await this.activityLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: ActivityAction.AccountCreated,
      detail: `Created account for ${user.username} with role ${user.role}`,
    });
    return user;
  }

  @Patch('me')
  async updateMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.update(req.user.userId, dto);
    await this.activityLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: ActivityAction.ProfileUpdated,
      detail: 'Updated own profile',
    });
    return updated;
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SuperAdmin)
  @Patch(':id')
  async update(@Request() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const partial: Record<string, unknown> = {};
    if (dto.role !== undefined) partial.role = dto.role;
    if (dto.isActive !== undefined) partial.isActive = dto.isActive;
    if (dto.departmentId !== undefined) partial.departmentId = dto.departmentId;
    if (dto.password !== undefined) partial.password = dto.password;

    const updated = await this.usersService.update(id, partial);
    await this.activityLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: ActivityAction.AccountUpdated,
      detail: `Updated account ${user.username}`,
    });
    return updated;
  }

  @Get(':id')
  async getProfile(@Param('id', ParseIntPipe) id: number) {
    const profile = await this.usersService.getUserProfile(id);
    if (!profile) throw new NotFoundException('User not found');
    return profile;
  }
}
