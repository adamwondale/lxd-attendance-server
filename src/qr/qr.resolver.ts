import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { QrService } from './qr.service';
import { PrismaService } from '../prisma/prisma.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

@Resolver()
export class QrResolver {
  constructor(
    private readonly qrService: QrService,
    private readonly prisma: PrismaService,
  ) {}

  @Query(() => String)
  @UseGuards(GqlAuthGuard)
  myQrBadge(@CurrentUser() user: AuthenticatedUser) {
    return this.qrService.generateStudentQr(user.userId);
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async studentQrBadge(
    @CurrentUser() user: AuthenticatedUser,
    @Args('studentId') studentId: string,
  ) {
    const student = await this.prisma.userTenantRole.findFirst({
      where: { userId: studentId, tenantId: user.tenantId!, role: 'STUDENT' },
      select: { userId: true },
    });
    if (!student) throw new ForbiddenException('Student is not accessible for this tenant.');
    return this.qrService.generateStudentQr(studentId);
  }

  @Query(() => String)
  async projectorQr(
    @Args('cohortId') cohortId: string,
    @Args('sessionId', { nullable: true }) sessionId?: string,
  ) {
    const cohort = await this.prisma.cohort.findFirst({
      where: {
        id: cohortId,
        isActive: true,
        endDate: { gte: new Date() },
      },
      select: {
        id: true,
        sessions: { select: { id: true } },
      },
    });

    if (!cohort) throw new ForbiddenException('Cohort is not active or does not exist.');
    if (sessionId && !cohort.sessions.some((session) => session.id === sessionId)) {
      throw new ForbiddenException('Session is not part of this cohort.');
    }

    return this.qrService.generateQr(cohort.id, sessionId);
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async generateCohortQr(
    @CurrentUser() user: AuthenticatedUser,
    @Args('cohortId') cohortId: string,
  ) {
    const cohort = await this.prisma.cohort.findFirst({
      where: { id: cohortId, tenantId: user.tenantId! },
      select: { id: true },
    });
    if (!cohort) throw new ForbiddenException('Cohort is not accessible for this tenant.');
    return this.qrService.generateQr(cohortId);
  }
}
