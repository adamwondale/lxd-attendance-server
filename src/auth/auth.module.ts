import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { GqlAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
    }),
  ],
  providers: [JwtStrategy, GqlAuthGuard, AuthService, AuthResolver],
  exports: [GqlAuthGuard, JwtModule, AuthService],
})
export class AuthModule {}
