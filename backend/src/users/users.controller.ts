import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { User } from './entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.SuperAdmin)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(Role.SuperAdmin)
  @Post()
  create(@Body() userDto: Partial<User>) {
    return this.usersService.create(userDto);
  }
}
