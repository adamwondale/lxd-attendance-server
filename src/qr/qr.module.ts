import { Module } from '@nestjs/common';
import { QrResolver } from './qr.resolver';
import { QrService } from './qr.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [QrResolver, QrService],
  exports: [QrService],
})
export class QrModule {}
