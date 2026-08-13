import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { Role } from './roles.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.RegularUser)
  @Post('create-post')
  createPost() {
    return {
      message: 'Post created successfully.',
      allowedFor: [Role.SuperAdmin, Role.RegularUser],
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin, Role.Moderator)
  @Post('delete-comment')
  deleteComment() {
    return {
      message: 'Comment deleted successfully.',
      allowedFor: [Role.SuperAdmin, Role.Moderator],
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SuperAdmin)
  @Post('delete-anything')
  deleteAnything() {
    return {
      message: 'Super Admin can delete any resource in the system.',
      allowedFor: [Role.SuperAdmin],
    };
  }

  @Get('public-view')
  publicView() {
    return {
      message: 'Guest users and everyone can view/read everything here.',
      allowedFor: [Role.Guest, Role.RegularUser, Role.Moderator, Role.SuperAdmin],
    };
  }
}
