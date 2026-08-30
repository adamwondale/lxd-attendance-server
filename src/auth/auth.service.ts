import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async registerAdmin(
    email: string,
    passwordRaw: string,
    name: string,
    tenantName: string,
    companyPhone?: string,
    username?: string,
    companyEmail?: string,
  ) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, ...(username ? [{ username }] : [])] } });
    if (existing) throw new BadRequestException('Admin email or username already exists');
    if (passwordRaw.length < 6) throw new BadRequestException('Password must be at least 6 characters');

    const hashedPassword = await bcrypt.hash(passwordRaw, 10);
    return this.prisma.$transaction(async (tx) => {
      const slugBase = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: `${slugBase}-${Date.now()}`,
          companyEmail: companyEmail || email,
          companyPhone,
          adminName: name,
        },
      });
      const user = await tx.user.create({
        data: {
          email,
          name,
          username,
          phone: companyPhone,
          password: hashedPassword,
          tenants: { create: { tenantId: tenant.id, role: 'SUPER_ADMIN' } },
        },
      });
      return user;
    });
  }

  async loginAdmin(email: string, passwordRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { tenants: true } });
    const adminRole = user?.tenants?.find(t => ['SUPER_ADMIN', 'COORDINATOR'].includes(t.role));
    if (!user || !user.password || !adminRole) throw new UnauthorizedException('Invalid credentials');
    if (!(await bcrypt.compare(passwordRaw, user.password))) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: user.id, email: user.email, role: adminRole.role, tenantId: adminRole.tenantId };
    return { accessToken: this.jwtService.sign(payload, { expiresIn: '7d' }) };
  }

  async registerStudent(email: string, passwordRaw: string, name: string, phone: string, username: string, cohortId?: string, sessionId?: string, cohortPin?: string) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { phone }, { username }] } });
    if (existing) throw new BadRequestException('User with that email, phone, or username already exists');
    let selectedCohort: any = null;
    if (cohortId || sessionId) {
      if (!cohortId || !sessionId || !cohortPin) throw new BadRequestException('Cohort, session and cohort PIN are required for assignment');
      selectedCohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
      const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId } });
      if (!selectedCohort || !selectedCohort.isActive || selectedCohort.pin !== cohortPin || !session || session.cohortId !== cohortId) throw new BadRequestException('Invalid cohort, session or PIN');
    }
    const hashedPassword = await bcrypt.hash(passwordRaw, 10);
    const user = await this.prisma.user.create({ data: { email, name, phone, username, password: hashedPassword } });
    if (selectedCohort) {
      await this.prisma.cohortMembership.create({ data: { userId: user.id, cohortId: selectedCohort.id, sessionId, status: 'ACTIVE' } });
      await this.prisma.userTenantRole.create({ data: { userId: user.id, tenantId: selectedCohort.tenantId, role: 'STUDENT' } });
    }
    return user;
  }

  async loginStudent(identifier: string, passwordRaw: string) {
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] }, include: { tenants: true } });
    if (!user || !user.password) throw new UnauthorizedException('Invalid credentials');
    if (!(await bcrypt.compare(passwordRaw, user.password))) throw new UnauthorizedException('Invalid credentials');
    const studentRole = user.tenants.find(t => t.role === 'STUDENT');
    const payload = { sub: user.id, email: user.email, role: 'STUDENT', tenantId: studentRole?.tenantId };
    return { accessToken: this.jwtService.sign(payload, { expiresIn: '180d' }) };
  }

  async loginWithGoogle(idToken: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    let payload: any;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (e) {
      console.error('Google token verification failed:', e);
      throw new BadRequestException('Invalid Google token');
    }
    if (!payload?.email) throw new BadRequestException('Invalid Google payload');

    let user = await this.prisma.user.findFirst({ where: { OR: [{ oauthId: payload.sub }, { email: payload.email }] }, include: { tenants: true } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email: payload.email, name: payload.name || 'Student', oauthId: payload.sub }, include: { tenants: true } });
    } else if (!user.oauthId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { oauthId: payload.sub }, include: { tenants: true } });
    }
    const studentRole = user.tenants.find(t => t.role === 'STUDENT');
    const jwtPayload = { sub: user.id, email: user.email, role: 'STUDENT', tenantId: studentRole?.tenantId };
    return { accessToken: this.jwtService.sign(jwtPayload, { expiresIn: '180d' }) };
  }
}
