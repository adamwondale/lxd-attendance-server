import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'QtNDNr4Ii0x1Zaqw8geuV1ZE1wxhSqOSMCH9URZIXwS',
    });
  }

  async validate(payload: any) {
    const tenantRole = await this.prisma.userTenantRole.findFirst({
      where: { userId: payload.sub },
      orderBy: { id: 'asc' },
    });

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role || tenantRole?.role,
      tenantId: payload.tenantId || tenantRole?.tenantId,
    };
  }
}
