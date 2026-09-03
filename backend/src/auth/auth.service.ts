import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.usersService.findOne(username);
    if (user && user.password === password) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (user.isActive === false) {
      throw new UnauthorizedException('Account is deactivated. Contact an administrator.');
    }

    await this.usersService.update(user.userId, {
      lastLoginAt: new Date(),
      lastSeenAt: new Date(),
      loginCount: (user.loginCount ?? 0) + 1,
    });

    await this.activityLogService.log({
      userId: user.userId,
      username: user.username,
      action: ActivityAction.Login,
      detail: `Signed in as ${user.role}`,
    });

    return {
      access_token: this.jwtService.sign({
        username: user.username,
        sub: user.userId,
        role: user.role,
      }),
      role: user.role,
      userId: user.userId,
      username: user.username,
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.getUserProfile(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const { password: _password, ...result } = user;
    return result;
  }
}
