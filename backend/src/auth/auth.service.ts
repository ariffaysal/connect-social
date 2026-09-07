import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ActivityLogService } from '../monitoring/activity-log.service';
import { ActivityAction } from '../monitoring/entities/activity-log.entity';
import { isBcryptHash, verifyPassword } from './password.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  /**
   * Verifies credentials. Returns the safe (password-less) user plus a flag
   * telling the caller the account still stores a legacy plaintext password
   * and should be re-hashed on the next successful login.
   */
  async validateUser(username: string, password: string) {
    const user = await this.usersService.findOne(username);
    if (!user || !user.password) {
      return null;
    }
    const passwordOk = isBcryptHash(user.password)
      ? await verifyPassword(password, user.password)
      : user.password === password;
    if (!passwordOk) {
      return null;
    }
    const { password: _password, ...safeUser } = user;
    return { user: safeUser, needsPasswordUpgrade: !isBcryptHash(user.password) };
  }

  async login(loginDto: LoginDto) {
    const result = await this.validateUser(loginDto.username, loginDto.password);
    if (!result) {
      throw new UnauthorizedException('Invalid username or password');
    }
    const { user, needsPasswordUpgrade } = result;
    if (user.isActive === false) {
      throw new UnauthorizedException('Account is deactivated. Contact an administrator.');
    }

    const updates: Record<string, unknown> = {
      lastLoginAt: new Date(),
      lastSeenAt: new Date(),
      loginCount: (user.loginCount ?? 0) + 1,
    };
    // Legacy accounts created before bcrypt was introduced: re-hash the
    // plaintext password now that it has been verified. usersService.update
    // hashes any password it receives.
    if (needsPasswordUpgrade) {
      updates.password = loginDto.password;
    }

    await this.usersService.update(user.userId, updates);

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
    try {
      // Get basic user info without heavy profile queries (optimized for serverless)
      const user = await this.usersService.findById(userId);
      if (!user) throw new UnauthorizedException('User not found');
      
      // Only fetch extended profile data (counts, department) if needed
      // This keeps the endpoint fast in serverless environments
      const { password: _password, ...result } = user;
      
      // Optionally fetch department name if user has a department
      if (user.departmentId) {
        try {
          const dept = await this.usersService.getDepartment(user.departmentId);
          if (dept) {
            return { ...result, departmentName: dept.name, departmentColor: dept.color };
          }
        } catch (deptErr) {
          // Log but don't fail - department info is optional
          console.warn('Failed to fetch department:', deptErr);
        }
      }
      
      return result;
    } catch (err) {
      console.error('getProfile error:', err);
      throw err;
    }
  }
}
