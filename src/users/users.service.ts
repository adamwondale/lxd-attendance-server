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
    // Include both students with an explicit tenant role and older portal
    // registrations that are linked to this tenant through a cohort membership.
    // The latter were previously hidden from the admin Students page.
    return this.prisma.user.findMany({
      where: {
        OR: [
          {
            tenants: {
              some: {
                tenantId,
                role: 'STUDENT',
              },
            },
          },
          {
            cohorts: {
              some: {
                cohort: { tenantId },
              },
            },
          },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminCreateStudent(
    tenantId: string,
    name: string,
    email: string,
    phone: string,
    username: string,
    password: string,
    cohortId?: string,
    sessionId?: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }, ...(phone ? [{ phone }] : [])] },
    });
    if (existing) throw new Error('A student with that email, username, or phone already exists');

    let cohort: { id: string; tenantId: string; isActive: boolean } | null = null;
    let session: { id: string; cohortId: string } | null = null;

    if (cohortId || sessionId) {
      if (!cohortId || !sessionId) throw new Error('Cohort and session are required together');
      cohort = await this.prisma.cohort.findFirst({
        where: { id: cohortId, tenantId },
        select: { id: true, tenantId: true, isActive: true },
      });
      session = await this.prisma.cohortSession.findFirst({
        where: { id: sessionId, cohort: { tenantId } },
        select: { id: true, cohortId: true },
      });
      if (!cohort || !cohort.isActive || !session || session.cohortId !== cohortId) {
        throw new Error('Invalid cohort or session');
      }
    }

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash(password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, phone, username, password: hashed },
      });

      await tx.userTenantRole.create({
        data: { userId: user.id, tenantId, role: 'STUDENT' },
      });

      if (cohort && session) {
        await tx.cohortMembership.create({
          data: { userId: user.id, cohortId: cohort.id, sessionId: session.id, status: 'ACTIVE' },
        });
      }

      return user;
    });
  }

  async adminUpdateStudent(tenantId: string, id: string, name?: string, email?: string, username?: string) {
    const data: Record<string, string> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (username !== undefined) data.username = username;

    const result = await this.prisma.user.updateMany({
      where: { id, tenants: { some: { tenantId, role: 'STUDENT' } } },
      data,
    });
    if (!result.count) throw new Error('Student not found in this tenant');
    return this.prisma.user.findUnique({ where: { id } });
  }

  async adminDeleteStudent(tenantId: string, id: string) {
    const result = await this.prisma.userTenantRole.deleteMany({
      where: { userId: id, tenantId, role: 'STUDENT' },
    });
    if (!result.count) throw new Error('Student not found in this tenant');
    return true;
  }

  async adminEnrollStudent(tenantId: string, userId: string, cohortId: string, sessionId: string) {
    const [student, cohort, session] = await Promise.all([
      this.prisma.userTenantRole.findFirst({ where: { userId, tenantId, role: 'STUDENT' } }),
      this.prisma.cohort.findFirst({ where: { id: cohortId, tenantId }, select: { id: true, isActive: true } }),
      this.prisma.cohortSession.findFirst({ where: { id: sessionId, cohort: { tenantId } }, select: { id: true, cohortId: true } }),
    ]);
    if (!student || !cohort || !cohort.isActive || !session || session.cohortId !== cohortId) {
      throw new Error('User, cohort, or session is not valid for this tenant');
    }
    return this.prisma.cohortMembership.create({
      data: { userId, cohortId, sessionId, status: 'ACTIVE' },
    });
  }

  async adminUpdateStudentMembership(tenantId: string, userId: string, cohortId: string, sessionId: string) {
    const [student, cohort, session] = await Promise.all([
      this.prisma.userTenantRole.findFirst({ where: { userId, tenantId, role: 'STUDENT' } }),
      this.prisma.cohort.findFirst({ where: { id: cohortId, tenantId }, select: { id: true } }),
      this.prisma.cohortSession.findFirst({ where: { id: sessionId, cohort: { tenantId } }, select: { id: true, cohortId: true } }),
    ]);
    if (!student || !cohort || !session || session.cohortId !== cohortId) {
      throw new Error('User, cohort, or session is not valid for this tenant');
    }

    const result = await this.prisma.cohortMembership.updateMany({
      where: { cohortId, userId, cohort: { tenantId } },
      data: { sessionId },
    });
    if (!result.count) throw new Error('Student membership not found in this tenant');
    return true;
  }

  async adminRemoveStudentFromCohort(tenantId: string, userId: string, cohortId: string) {
    const [student, cohort] = await Promise.all([
      this.prisma.userTenantRole.findFirst({ where: { userId, tenantId, role: 'STUDENT' } }),
      this.prisma.cohort.findFirst({ where: { id: cohortId, tenantId }, select: { id: true } }),
    ]);
    if (!student || !cohort) throw new Error('User or cohort is not valid for this tenant');

    const result = await this.prisma.cohortMembership.deleteMany({
      where: { cohortId, userId, cohort: { tenantId } },
    });
    if (!result.count) throw new Error('Student membership not found in this tenant');
    return true;
  }

  async getMemberships(userId: string, tenantId?: string) {
    return this.prisma.cohortMembership.findMany({
      where: { userId, ...(tenantId ? { cohort: { tenantId } } : {}) },
      include: {
        cohort: true,
        session: true,
      }
    });
  }
}
