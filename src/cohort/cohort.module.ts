import { Module } from '@nestjs/common';
import { CohortResolver } from './cohort.resolver';
import { CohortService } from './cohort.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [CohortResolver, CohortService],
  exports: [CohortService],
})
export class CohortModule {}
