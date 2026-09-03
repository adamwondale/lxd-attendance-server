import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CohortService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTenantId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenants: true },
    });
    const tenantId = user?.tenants?.[0]?.tenantId;
    if (!tenantId) throw new BadRequestException('User has no active tenant');
    return tenantId;
  }

  private calculateDurationMonths(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid cohort dates');
    }
    if (endDate < startDate) {
      throw new BadRequestException('Cohort end date must be on or after the start date');
    }
    const days = (endDate.getTime() - startDate.getTime()) / 86_400_000;
    return Math.max(1, Math.round(days / 30.4375));
  }

  async createCohort(
    tenantId: string,
    name: string,
    pin: string,
    startDate: Date,
    endDate: Date,
  ) {
    const durationMonths = this.calculateDurationMonths(startDate, endDate);

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
        durationMonths,
      },
    });
  }

  async updateCohort(
    tenantId: string,
    cohortId: string,
    name?: string,
    pin?: string,
    startDate?: Date,
    endDate?: Date,
    isActive?: boolean,
  ) {

    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
    });
    if (!cohort) throw new BadRequestException('Cohort not found');

    const nextStartDate = startDate ?? cohort.startDate;
    const nextEndDate = endDate ?? cohort.endDate;
    const durationMonths = this.calculateDurationMonths(nextStartDate, nextEndDate);

    const result = await this.prisma.cohort.updateMany({
      where: { id: cohortId, tenantId },
      data: {
        ...(name !== undefined && { name }),
        ...(pin !== undefined && { pin }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(isActive !== undefined && { isActive }),
        durationMonths,
      },
    });
    if (!result.count) throw new BadRequestException('Cohort not found');
    return this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } });
  }

  async deleteCohort(tenantId: string, cohortId: string) {
    const result = await this.prisma.cohort.updateMany({
      where: { id: cohortId, tenantId },
      data: { isActive: false },
    });
    if (!result.count) throw new BadRequestException('Cohort not found');
    return true;
  }

  async createCohortSession(
    tenantId: string,
    cohortId: string,
    name: string,
    startTime: string,
    gracePeriodMinutes: number,
    recurrenceDays: string[],
    latePenaltyAmount: number,
    escalationThresholdMinutes = 15,
    escalationRate = 5,
    escalationIntervalMinutes = 5,
  ) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
    });
    if (!cohort) throw new BadRequestException('Cohort not found');

    return this.prisma.cohortSession.create({
      data: {
        cohortId,
        name,
        startTime,
        gracePeriodMinutes,
        recurrenceDays,
        latePenaltyAmount,
        escalationThresholdMinutes,
        escalationRate,
        escalationIntervalMinutes,
      },
    });
  }

  async updateCohortSession(
    tenantId: string,
    sessionId: string,
    name?: string,
    startTime?: string,
    gracePeriodMinutes?: number,
    recurrenceDays?: string[],
    latePenaltyAmount?: number,
    escalationThresholdMinutes?: number,
    escalationRate?: number,
    escalationIntervalMinutes?: number,
  ) {
    const session = await this.prisma.cohortSession.findFirst({
      where: { id: sessionId, cohort: { tenantId } },
    });
    if (!session) throw new BadRequestException('Session not found');

    return this.prisma.cohortSession.update({
      where: { id: sessionId },
      data: {
        ...(name !== undefined && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(gracePeriodMinutes !== undefined && { gracePeriodMinutes }),
        ...(recurrenceDays !== undefined && { recurrenceDays }),
        ...(latePenaltyAmount !== undefined && { latePenaltyAmount }),
        ...(escalationThresholdMinutes !== undefined && {
          escalationThresholdMinutes,
        }),
        ...(escalationRate !== undefined && { escalationRate }),
        ...(escalationIntervalMinutes !== undefined && {
          escalationIntervalMinutes,
        }),
      },
    });
  }

  async deleteCohortSession(tenantId: string, sessionId: string) {
    const result = await this.prisma.cohortSession.deleteMany({
      where: { id: sessionId, cohort: { tenantId } },
    });
    if (!result.count) throw new BadRequestException('Session not found');
    return true;
  }

  async listCohorts(userId: string) {
    const tenantId = await this.getTenantId(userId);

    return this.prisma.cohort.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
      include: { sessions: true },
    });
  }

  async getDashboardMetrics(userId: string) {
    const tenantId = await this.getTenantId(userId);

    const activeCohorts = await this.prisma.cohort.count({
      where: { tenantId, isActive: true },
    });
    const totalStudents = await this.prisma.user.count({
      // Keep the dashboard total consistent with listStudents().
      where: {
        OR: [
          { tenants: { some: { tenantId, role: 'STUDENT' } } },
          { cohorts: { some: { cohort: { tenantId } } } },
        ],
      },
    });

    const today = new Date();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tenant?.timezone || 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(today);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value || '';
    const dateStr = `${get('year')}-${get('month')}-${get('day')}`;

    const activeMemberships = await this.prisma.cohortMembership.findMany({
      where: { status: 'ACTIVE', cohort: { tenantId, isActive: true } },
      select: { userId: true },
    });
    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        date: dateStr,
        session: { cohort: { tenantId, isActive: true } },
      },
      select: { userId: true, isLate: true, calculatedPenalty: true },
    });
    const presentIds = new Set(logs.map((l) => l.userId));
    const lateIds = new Set(logs.filter((l) => l.isLate).map((l) => l.userId));
    const todayRevenue = logs.reduce(
      (sum, l) => sum + (l.calculatedPenalty || 0),
      0,
    );

    return {
      activeCohorts,
      totalStudents,
      presentToday: presentIds.size,
      absentToday: new Set(
        activeMemberships
          .map((m) => m.userId)
          .filter((id) => !presentIds.has(id)),
      ).size,
      lateToday: lateIds.size,
      todayRevenue,
    };
  }

  async getCompanyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenants: {
          include: { tenant: true },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const role = user.tenants?.find((t) =>
      ['SUPER_ADMIN', 'COORDINATOR'].includes(t.role),
    );

    if (!role) {
      throw new BadRequestException('User has no active company profile');
    }

    const tenant = role.tenant;

    return {
      id: tenant.id,
      companyName: tenant.name,
      companyEmail: tenant.companyEmail || user.email,
      companyPhone: tenant.companyPhone || user.phone,
      adminName: tenant.adminName || user.name,
      username: user.username,
      timezone: tenant.timezone,
    };
  }

  async updateCompanyProfile(
    userId: string,
    companyName?: string,
    companyEmail?: string,
    companyPhone?: string,
    adminName?: string,
    username?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        tenants: {
          where: { role: { in: ['ADMIN', 'COORDINATOR', 'SUPER_ADMIN'] } },
          include: { tenant: true },
          take: 1,
        },
      },
    });

    const tenantId = user?.tenants?.[0]?.tenantId;
    if (!user || !tenantId) {
      throw new BadRequestException('User has no active company profile');
    }

    if (username && username !== user.username) {
      const duplicate = await this.prisma.user.findFirst({
        where: { username, NOT: { id: userId } },
      });
      if (duplicate)
        throw new BadRequestException('Username is already in use');
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(companyName !== undefined && { name: companyName }),
        ...(companyEmail !== undefined && { companyEmail }),
        ...(companyPhone !== undefined && { companyPhone }),
        ...(adminName !== undefined && { adminName }),
      },
    });
    if (
      adminName !== undefined ||
      username !== undefined ||
      companyPhone !== undefined ||
      companyEmail !== undefined
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(adminName !== undefined && { name: adminName }),
          ...(username !== undefined && { username }),
          ...(companyPhone !== undefined && { phone: companyPhone }),
          ...(companyEmail !== undefined && { email: companyEmail }),
        },
      });
    }
    return this.getCompanyProfile(userId);
  }

  async getCohortDetails(tenantId: string, cohortId: string) {
    return this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId },
      include: {
        sessions: true,
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async publicActiveCohorts() {
    return this.prisma.cohort.findMany({
      where: { isActive: true, endDate: { gte: new Date() } },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        durationMonths: true,
        sessions: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async availableCohorts(userId: string) {
    return this.prisma.cohort.findMany({
      where: {
        isActive: true,
        memberships: {
          none: { userId },
        },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        durationMonths: true,
        sessions: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async myCohorts(userId: string) {
    // Return all cohorts the user IS a member of
    const memberships = await this.prisma.cohortMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        cohort: {
          include: { sessions: true },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => m.cohort);
  }

  async joinCohort(
    userId: string,
    cohortId: string,
    sessionId: string,
    pin: string,
  ) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) throw new BadRequestException('Cohort not found');
    if (cohort.pin !== pin) throw new BadRequestException('Invalid PIN');
    if (!cohort.isActive)
      throw new BadRequestException('Cohort is no longer active');

    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.cohortId !== cohortId) {
      throw new BadRequestException('Invalid Session ID');
    }

    const existingMembership = await this.prisma.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
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
        status: 'ACTIVE',
      },
    });

    // 2. Add the user to the Cohort's Tenant (if not already there)
    const existingTenantRole = await this.prisma.userTenantRole.findUnique({
      where: { userId_tenantId: { userId, tenantId: cohort.tenantId } },
    });

    if (!existingTenantRole) {
      await this.prisma.userTenantRole.create({
        data: {
          userId,
          tenantId: cohort.tenantId,
          role: 'STUDENT',
        },
      });
    }

    return true;
  }

  async getJoinedSession(userId: string, cohortId: string) {
    const membership = await this.prisma.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
      include: { session: true },
    });
    return membership?.session || null;
  }
}
