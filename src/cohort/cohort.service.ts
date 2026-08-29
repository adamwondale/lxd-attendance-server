import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CohortService {
  constructor(private readonly prisma: PrismaService) {}

  async createCohort(userId: string, name: string, pin: string, startDate: Date, endDate: Date) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenants: true } });
    const tenantId = user?.tenants?.[0]?.tenantId;
    if (!tenantId) throw new BadRequestException('User has no active tenant');

    const existing = await this.prisma.cohort.findUnique({ where: { pin } });
    if (existing) {
      throw new BadRequestException('A cohort with this PIN already exists');
    }

    return await this.prisma.cohort.create({
      data: {
        tenantId,
        name,
        pin,
        startDate,
        endDate,
        isActive: true,
      },
    });
  }

  async updateCohort(cohortId: string, name?: string, pin?: string, startDate?: Date, endDate?: Date, isActive?: boolean) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new BadRequestException('Cohort not found');

    return this.prisma.cohort.update({
      where: { id: cohortId },
      data: {
        ...(name !== undefined && { name }),
        ...(pin !== undefined && { pin }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(isActive !== undefined && { isActive }),
      }
    });
  }

  async deleteCohort(cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new BadRequestException('Cohort not found');
    
    // Soft delete cohort
    await this.prisma.cohort.update({
      where: { id: cohortId },
      data: { isActive: false }
    });
    
    return true;
  }

  async createCohortSession(cohortId: string, name: string, startTime: string, gracePeriodMinutes: number, recurrenceDays: string[], latePenaltyAmount: number) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new BadRequestException('Cohort not found');

    return this.prisma.cohortSession.create({
      data: {
        cohortId,
        name,
        startTime,
        gracePeriodMinutes,
        recurrenceDays,
        latePenaltyAmount,
      }
    });
  }

  async updateCohortSession(sessionId: string, name?: string, startTime?: string, gracePeriodMinutes?: number, recurrenceDays?: string[], latePenaltyAmount?: number) {
    const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');

    return this.prisma.cohortSession.update({
      where: { id: sessionId },
      data: {
        ...(name !== undefined && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(gracePeriodMinutes !== undefined && { gracePeriodMinutes }),
        ...(recurrenceDays !== undefined && { recurrenceDays }),
        ...(latePenaltyAmount !== undefined && { latePenaltyAmount }),
      }
    });
  }

  async deleteCohortSession(sessionId: string) {
    const session = await this.prisma.cohortSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Session not found');

    await this.prisma.cohortSession.delete({ where: { id: sessionId } });
    return true;
  }

  async listCohorts(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenants: true } });
    const tenantId = user?.tenants?.[0]?.tenantId;
    if (!tenantId) throw new BadRequestException('User has no active tenant');

    return this.prisma.cohort.findMany({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async getDashboardMetrics(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { tenants: true } });
    const tenantId = user?.tenants?.[0]?.tenantId;
    if (!tenantId) throw new BadRequestException('User has no active tenant');

    // 1. Active Cohorts
    const activeCohorts = await this.prisma.cohort.count({
      where: { tenantId, isActive: true },
    });

    // 2. Total Students
    const totalStudents = await this.prisma.user.count({
      where: {
        tenants: {
          some: {
            tenantId,
            role: 'STUDENT',
          },
        },
      },
    });

    // 3. Today's Revenue
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const penalties = await this.prisma.penalty.findMany({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        attendanceLog: {
          session: {
            cohort: { tenantId }
          }
        }
      }
    });
    
    const todayRevenue = penalties.reduce((sum, penalty) => sum + penalty.amount, 0);

    return {
      activeCohorts,
      totalStudents,
      todayRevenue,
    };
  }

  async getCohortDetails(cohortId: string) {
    return this.prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        sessions: true,
        memberships: {
          include: {
            user: true
          }
        }
      }
    });
  }

  async availableCohorts(userId: string) {
    // Return all active cohorts that the user is NOT already a member of
    return this.prisma.cohort.findMany({
      where: {
        isActive: true,
        memberships: {
          none: { userId }
        }
      },
      include: { sessions: true },
      orderBy: { startDate: 'desc' }
    });
  }

  async myCohorts(userId: string) {
    // Return all cohorts the user IS a member of
    const memberships = await this.prisma.cohortMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { 
        cohort: {
          include: { sessions: true }
        } 
      },
      orderBy: { joinedAt: 'desc' }
    });
    return memberships.map(m => m.cohort);
  }

  async joinCohort(userId: string, cohortId: string, sessionId: string, pin: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId }
    });

    if (!cohort) throw new BadRequestException('Cohort not found');
    if (cohort.pin !== pin) throw new BadRequestException('Invalid PIN');
    if (!cohort.isActive) throw new BadRequestException('Cohort is no longer active');

    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId }
    });
    if (!session || session.cohortId !== cohortId) {
      throw new BadRequestException('Invalid Session ID');
    }

    const existingMembership = await this.prisma.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId } }
    });

    if (existingMembership) {
      throw new BadRequestException('You are already enrolled in this cohort');
    }

    // 1. Create the Cohort Membership
    await this.prisma.cohortMembership.create({
      data: {
        cohortId,
        userId,
        sessionId,
        status: 'ACTIVE'
      }
    });

    // 2. Add the user to the Cohort's Tenant (if not already there)
    const existingTenantRole = await this.prisma.userTenantRole.findUnique({
      where: { userId_tenantId: { userId, tenantId: cohort.tenantId } }
    });

    if (!existingTenantRole) {
      await this.prisma.userTenantRole.create({
        data: {
          userId,
          tenantId: cohort.tenantId,
          role: 'STUDENT'
        }
      });
    }

    return true;
  }

  async getJoinedSession(userId: string, cohortId: string) {
    const membership = await this.prisma.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
      include: { session: true }
    });
    return membership?.session || null;
  }
}
