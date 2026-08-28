import { Module } from '@nestjs/common';
import { AttendanceResolver } from './attendance.resolver';
import { AttendanceService } from './attendance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PubSub } from 'graphql-subscriptions';
import { QrModule } from '../qr/qr.module';

@Module({
  imports: [PrismaModule, AuthModule, QrModule],
  providers: [
    AttendanceResolver, 
    AttendanceService,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
