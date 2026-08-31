import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

const jwtSecret = process.env.JWT_SECRET?.trim();

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    if (!jwtSecret) throw new Error('JWT_SECRET must be set and non-empty at startup.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
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
