import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PubSub } from 'graphql-subscriptions';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    UsersResolver, 
    UsersService,
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    }
  ],
  exports: [UsersService],
})
export class UsersModule {}
