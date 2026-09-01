import { Resolver, Mutation, Query, Args, Subscription, Int } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

import { PrismaService } from '../prisma/prisma.service';
import { PubSub } from 'graphql-subscriptions';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import type { PubSub } from 'graphql-subscriptions';
import { AttendanceLog, AttendanceEvent, AttendanceReportRow, StudentAttendanceSummary, Penalty } from './dto/attendance.type';

@Resolver()
export class AttendanceResolver {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
    @Inject('PUB_SUB') private pubSub: PubSub,
  ) {}

  @Query(() => StudentAttendanceSummary)
  @UseGuards(GqlAuthGuard)
  async myAttendanceSummary(@CurrentUser() user: any) {
    return this.attendanceService.getMyAttendanceSummary(user.userId);
  }

  @Query(() => [AttendanceLog])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async getAttendanceLogs(
    @CurrentUser() user: any,
    @Args('cohortId', { nullable: true }) cohortId?: string,
    @Args('sessionId', { nullable: true }) sessionId?: string,
  ) {
    return this.attendanceService.getAttendanceLogs(cohortId, sessionId, user.tenantId);
  }

  @Query(() => [AttendanceEvent])
  async projectorRecentScans(
    @Args('cohortId') cohortId: string,
    @Args('sessionId', { nullable: true }) sessionId?: string,
  ) {
    const rows = await this.prisma.attendanceLog.findMany({
      where: {
        session: {
          cohort: {
            id: cohortId,
            isActive: true,
            endDate: { gte: new Date() },
          },
          ...(sessionId ? { id: sessionId } : {}),
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        penalty: true,
      },
      orderBy: { scannedAt: 'desc' },
      take: 30,
    });

    return rows.map((log) => ({
      id: log.id,
      cohortId,
      sessionId: log.sessionId,
      date: log.date,
      scannedAt: log.scannedAt,
      user: log.user,
      isLate: log.isLate,
      latenessMinutes: log.latenessMinutes || 0,
      calculatedPenalty: log.penalty?.amount || log.calculatedPenalty || 0,
    }));
  }

  @Query(() => [AttendanceReportRow])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async attendanceReport(
    @CurrentUser() user: any,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('cohortId', { nullable: true }) cohortId?: string,
    @Args('sessionId', { nullable: true }) sessionId?: string,
  ) {
    return this.attendanceService.getAttendanceReport(user.tenantId, startDate, endDate, cohortId, sessionId);
  }

  @Mutation(() => Penalty)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async waivePenalty(
    @CurrentUser() user: AuthenticatedUser,
    @Args('penaltyId') penaltyId: string,
  ) {
    const penalty = await this.attendanceService.waivePenalty(penaltyId, user.tenantId!);
    this.pubSub.publish('attendanceUpdated', { onAttendanceUpdated: true });
    return penalty;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async logAttendance(
    @CurrentUser() user: any,
    @Args('qrCode') qrCode: string,
    @Args('deviceSignature', { nullable: true }) deviceSignature?: string,
  ) {
    const parts = qrCode.split('.');
    const cohortId = parts[0] || '';
    const log: any = await this.attendanceService.logAttendance(user.userId, qrCode, deviceSignature);
    if (log) this.publishAttendance(log, cohortId);
    return log.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  async logAttendanceById(
    @CurrentUser() user: AuthenticatedUser,
    @Args('traineeId') _traineeId: string,
    @Args('qrCode') qrCode: string,
    @Args('deviceSignature', { nullable: true }) deviceSignature?: string,
  ) {
    const parts = qrCode.split('.');
    const cohortId = parts[0] || '';
    const log: any = await this.attendanceService.logAttendanceById(user.userId, qrCode, deviceSignature);
    if (log) this.publishAttendance(log, cohortId);
    return log.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async adminLogAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Args('studentId') studentId: string,
    @Args('sessionId') sessionId: string,
  ) {
    const log: any = await this.attendanceService.adminLogAttendance(user.tenantId!, studentId, sessionId);
    if (log) this.publishAttendance(log, log.session?.cohortId || '');
    return log.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async adminScanStudentBadge(
    @CurrentUser() user: AuthenticatedUser,
    @Args('badgeCode') badgeCode: string,
  ) {
    const log: any = await this.attendanceService.adminScanStudentBadge(user.tenantId!, badgeCode);
    if (log) this.publishAttendance(log, log.session?.cohortId || '');
    return log.id;
  }

  private publishAttendance(log: any, cohortId: string) {
    const event = {
      id: log.id,
      cohortId,
      sessionId: log.sessionId,
      date: log.date,
      scannedAt: log.scannedAt,
      user: log.user,
      isLate: log.isLate,
      latenessMinutes: log.latenessMinutes || 0,
      calculatedPenalty: log.penalty?.amount || log.calculatedPenalty || 0,
    };
    this.pubSub.publish('attendanceLogged', { attendanceLogged: event });
    this.pubSub.publish('attendanceUpdated', { onAttendanceUpdated: true });
  }

  @Subscription(() => AttendanceEvent, {
    filter: (payload: any, variables: any) => payload.attendanceLogged.sessionId === variables.sessionId,
    resolve: (payload: any) => payload.attendanceLogged,
  })
  @UseGuards(GqlAuthGuard)
  async attendanceLogged(
    @CurrentUser() user: AuthenticatedUser,
    @Args('sessionId') sessionId: string,
  ) {
    await this.attendanceService.assertSessionAccess(user.userId, user.tenantId!, user.role, sessionId);
    return (this.pubSub as any).asyncIterableIterator('attendanceLogged');
  }

  @Subscription(() => Boolean)
  onAttendanceUpdated() {
    return (this.pubSub as any).asyncIterableIterator('attendanceUpdated');
  }
}
