import { Module } from '@nestjs/common';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [UsersResolver, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
