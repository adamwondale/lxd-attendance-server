import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async updateProfile(userId: string, name?: string, username?: string) {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (username !== undefined) data.username = username;

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async listStudents(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenants: {
          some: {
            tenantId,
            role: 'STUDENT',
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminCreateStudent(name: string, email: string, phone: string, username: string, password: string, cohortId?: string, sessionId?: string) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }, ...(phone ? [{ phone }] : [])] } });
    if (existing) throw new Error('A student with that email, username, or phone already exists');
    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({ data: { name, email, phone, username, password: hashed } });
    if (cohortId && sessionId) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
      const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId } });
      if (!cohort || !cohort.isActive || !session || session.cohortId !== cohortId) throw new Error('Invalid cohort or session');
      await this.prisma.cohortMembership.create({ data: { userId: user.id, cohortId, sessionId, status: 'ACTIVE' } });
      await this.prisma.userTenantRole.create({ data: { userId: user.id, tenantId: cohort.tenantId, role: 'STUDENT' } });
    }
    return user;
  }

  async adminUpdateStudent(id: string, name?: string, email?: string) {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async adminDeleteStudent(id: string) {
    // Soft-delete or hard-delete. For demo, we just remove the UserTenantRole so they don't show up in the tenant.
    await this.prisma.userTenantRole.deleteMany({
      where: { userId: id, role: 'STUDENT' },
    });

    // Optionally we could delete the user if they have no other roles, but keeping it safe for the demo.
    return true;
  }

  async adminEnrollStudent(userId: string, cohortId: string, sessionId: string) {
    return this.prisma.cohortMembership.create({
      data: {
        userId,
        cohortId,
        sessionId,
        status: 'ACTIVE',
      },
    });
  }

  async adminUpdateStudentMembership(userId: string, cohortId: string, sessionId: string) {
    return this.prisma.cohortMembership.update({
      where: {
        cohortId_userId: {
          cohortId,
          userId,
        },
      },
      data: {
        sessionId,
      },
    });
  }

  async adminRemoveStudentFromCohort(userId: string, cohortId: string) {
    await this.prisma.cohortMembership.delete({
      where: {
        cohortId_userId: {
          cohortId,
          userId,
        },
      },
    });
    return true;
  }

  async getMemberships(userId: string) {
    return this.prisma.cohortMembership.findMany({
      where: { userId },
      include: {
        cohort: true,
        session: true,
      }
    });
  }
}
