import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './constants';
import { UsersService } from '../users/users.service';

/**
 * Verifies the token *and* re-checks the account behind it on every request.
 *
 * A JWT is a snapshot taken at sign-in time. Trusting `sub` and `role` from
 * the token alone means a deactivated account or a demoted Moderator keeps its
 * access until the token expires (previously up to 7 days), and that
 * "deactivate the demo accounts" is not actually a revocation. So identity and
 * role are read from the database here, and only the session generation
 * (`ver`) comes from the token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.usersService.findAuthState(Number(payload.sub));
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    if (user.isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    // Authoritative at request time: a role change applies on the next request
    // instead of whenever the current token happens to lapse.
    return { userId: user.userId, username: user.username, role: user.role };
  }
}
