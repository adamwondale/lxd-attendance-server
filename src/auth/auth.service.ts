import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerAdmin(email: string, passwordRaw: string, name: string, tenantName: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(passwordRaw, 10);

    return await this.prisma.$transaction(async (tx) => {
      const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: `${slug}-${Date.now()}`,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          tenants: {
            create: {
              tenantId: tenant.id,
              role: 'SUPER_ADMIN',
            },
          },
        },
      });

      return user;
    });
  }

  async loginAdmin(email: string, passwordRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(passwordRaw, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: 'SUPER_ADMIN' }; // hardcoding role for MVP
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async registerStudent(email: string, passwordRaw: string, name: string, phone: string, username: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone },
          { username },
        ]
      }
    });
    
    if (existing) {
      throw new BadRequestException('User with that email, phone, or username already exists');
    }

    const hashedPassword = await bcrypt.hash(passwordRaw, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        phone,
        username,
        password: hashedPassword,
      },
    });

    return user;
  }

  async loginStudent(identifier: string, passwordRaw: string) {
    // identifier can be email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ]
      }
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(passwordRaw, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: 'STUDENT' };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '180d' }),
    };
  }

  async loginWithGoogle(idToken: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      console.error('Google token verification failed:', e);
      throw new BadRequestException('Invalid Google token');
    }

    if (!payload || !payload.email) {
      throw new BadRequestException('Invalid Google payload');
    }

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { oauthId: payload.sub },
          { email: payload.email },
        ],
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || 'Student',
          oauthId: payload.sub,
        },
      });
    } else if (!user.oauthId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { oauthId: payload.sub },
      });
    }

    const jwtPayload = { sub: user.id, email: user.email, role: 'STUDENT' };
    return {
      accessToken: this.jwtService.sign(jwtPayload, { expiresIn: '180d' }),
    };
  }
}
