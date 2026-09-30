import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { jwtConstants, jwtExpiresIn } from './constants';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    MonitoringModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      // Short-lived by default: sessions are re-validated per request and
      // revocable via `tokenVersion`, and a shorter window limits how long a
      // stolen token is useful. Override with JWT_EXPIRES_IN.
      signOptions: { expiresIn: jwtExpiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard],
})
export class AuthModule {}
