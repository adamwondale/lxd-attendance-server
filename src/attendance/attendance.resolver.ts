import { Resolver, Mutation, Query, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PubSub } from 'graphql-subscriptions';
import { AttendanceLog, Penalty } from './dto/attendance.type';

@Resolver()
export class AttendanceResolver {
  constructor(
    private readonly attendanceService: AttendanceService,
    @Inject('PUB_SUB') private pubSub: PubSub
  ) {}

  @Query(() => [AttendanceLog])
  @UseGuards(GqlAuthGuard, RolesGuard)
  async getAttendanceLogs(
    @Args('cohortId', { nullable: true }) cohortId?: string,
    @Args('sessionId', { nullable: true }) sessionId?: string
  ) {
    return this.attendanceService.getAttendanceLogs(cohortId, sessionId);
  }

  @Mutation(() => Penalty)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async waivePenalty(@Args('penaltyId') penaltyId: string) {
    const penalty = await this.attendanceService.waivePenalty(penaltyId);
    this.pubSub.publish('attendanceUpdated', { onAttendanceUpdated: true });
    return penalty;
  }

  @Mutation(() => String) // We will return string just to mock the schema type
  @UseGuards(GqlAuthGuard)
  async logAttendance(@CurrentUser() user: any, @Args('qrCode') qrCode: string) {
    const parts = qrCode.split('.');
    const cohortId = parts[0];
    const log = await this.attendanceService.logAttendance(user.userId, qrCode);
    if (log) {
      this.pubSub.publish('attendanceLogged', { attendanceLogged: { cohortId, logId: log.id } });
      this.pubSub.publish('attendanceUpdated', { onAttendanceUpdated: true });
    }
    return log.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async adminLogAttendance(
    @Args('studentId') studentId: string,
    @Args('sessionId') sessionId: string
  ) {
    const log = await this.attendanceService.adminLogAttendance(studentId, sessionId);
    if (log) {
      this.pubSub.publish('attendanceUpdated', { onAttendanceUpdated: true });
    }
    return log.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async adminScanStudentBadge(
    @Args('badgeCode') badgeCode: string,
    @Args('sessionId') sessionId: string
  ) {
    const log = await this.attendanceService.adminScanStudentBadge(badgeCode, sessionId);
    if (log) {
      this.pubSub.publish('attendanceUpdated', { onAttendanceUpdated: true });
    }
    return log.id;
  }

  @Subscription(() => String, {
    filter: (payload, variables) => payload.attendanceLogged.cohortId === variables.cohortId,
    resolve: (payload) => payload.attendanceLogged.logId,
  })
  attendanceLogged(@Args('cohortId') cohortId: string) {
    return (this.pubSub as any).asyncIterableIterator('attendanceLogged');
  }

  @Subscription(() => Boolean)
  onAttendanceUpdated() {
    return (this.pubSub as any).asyncIterableIterator('attendanceUpdated');
  }
}
