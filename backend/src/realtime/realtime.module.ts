import { Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
