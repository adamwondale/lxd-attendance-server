import { Resolver, Mutation, Query, Args, Int, Subscription, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Cohort, CohortSession } from './dto/cohort.type';
import { DashboardMetrics, CompanyProfile } from './dto/dashboard.type';
import { CohortService } from './cohort.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Resolver(() => Cohort)
export class CohortResolver {
  constructor(
    private readonly cohortService: CohortService,
    @Inject('PUB_SUB') private pubSub: PubSub
  ) {}

  @Mutation(() => String) 
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async createCohort(
    @CurrentUser() user: any,
    @Args('name') name: string,
    @Args('pin') pin: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('durationMonths', { type: () => Int, nullable: true }) durationMonths?: number,
  ) {
    const cohort = await this.cohortService.createCohort(
      user.userId,
      name,
      pin,
      new Date(startDate),
      new Date(endDate),
      durationMonths
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return cohort.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async updateCohort(
    @Args('cohortId') cohortId: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('pin', { nullable: true }) pin?: string,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('endDate', { nullable: true }) endDate?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('durationMonths', { type: () => Int, nullable: true }) durationMonths?: number,
  ) {
    const cohort = await this.cohortService.updateCohort(
      cohortId,
      name,
      pin,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      isActive,
      durationMonths
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return cohort.id;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async deleteCohort(
    @Args('cohortId') cohortId: string,
  ) {
    const deleted = await this.cohortService.deleteCohort(cohortId);
    if (deleted) {
      this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    }
    return deleted;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async createCohortSession(
    @Args('cohortId') cohortId: string,
    @Args('name') name: string,
    @Args('startTime') startTime: string,
    @Args('gracePeriodMinutes', { type: () => Int }) gracePeriodMinutes: number,
    @Args('recurrenceDays', { type: () => [String] }) recurrenceDays: string[],
    @Args('latePenaltyAmount', { type: () => Int }) latePenaltyAmount: number,
    @Args('escalationThresholdMinutes', { type: () => Int, nullable: true }) escalationThresholdMinutes?: number,
    @Args('escalationRate', { type: () => Int, nullable: true }) escalationRate?: number,
    @Args('escalationIntervalMinutes', { type: () => Int, nullable: true }) escalationIntervalMinutes?: number,
  ) {
    const session = await this.cohortService.createCohortSession(
      cohortId,
      name,
      startTime,
      gracePeriodMinutes,
      recurrenceDays,
      latePenaltyAmount,
      escalationThresholdMinutes,
      escalationRate,
      escalationIntervalMinutes
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return session.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async updateCohortSession(
    @Args('sessionId') sessionId: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('gracePeriodMinutes', { type: () => Int, nullable: true }) gracePeriodMinutes?: number,
    @Args('recurrenceDays', { type: () => [String], nullable: true }) recurrenceDays?: string[],
    @Args('latePenaltyAmount', { type: () => Int, nullable: true }) latePenaltyAmount?: number,
    @Args('escalationThresholdMinutes', { type: () => Int, nullable: true }) escalationThresholdMinutes?: number,
    @Args('escalationRate', { type: () => Int, nullable: true }) escalationRate?: number,
    @Args('escalationIntervalMinutes', { type: () => Int, nullable: true }) escalationIntervalMinutes?: number,
  ) {
    const session = await this.cohortService.updateCohortSession(
      sessionId,
      name,
      startTime,
      gracePeriodMinutes,
      recurrenceDays,
      latePenaltyAmount,
      escalationThresholdMinutes,
      escalationRate,
      escalationIntervalMinutes
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return session.id;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async deleteCohortSession(
    @Args('sessionId') sessionId: string,
  ) {
    const deleted = await this.cohortService.deleteCohortSession(sessionId);
    if (deleted) {
      this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    }
    return deleted;
  }

  @Query(() => [Cohort])
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async listCohorts(@CurrentUser() user: any) {
    return this.cohortService.listCohorts(user.userId);
  }

  @Query(() => Cohort, { nullable: true })
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async cohortDetails(@Args('id') id: string) {
    return this.cohortService.getCohortDetails(id);
  }

  @Query(() => DashboardMetrics)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async dashboardMetrics(@CurrentUser() user: any) {
    return this.cohortService.getDashboardMetrics(user.userId);
  }

  @Query(() => [Cohort])
  async publicActiveCohorts() {
    return this.cohortService.publicActiveCohorts();
  }

  @Query(() => [Cohort])
  @UseGuards(GqlAuthGuard)
  async availableCohorts(@CurrentUser() user: any) {
    return this.cohortService.availableCohorts(user.userId);
  }

  @Query(() => [Cohort])
  @UseGuards(GqlAuthGuard)
  async myCohorts(@CurrentUser() user: any) {
    return this.cohortService.myCohorts(user.userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async joinCohort(
    @CurrentUser() user: any,
    @Args('cohortId') cohortId: string,
    @Args('sessionId') sessionId: string,
    @Args('pin') pin: string,
  ) {
    const joined = await this.cohortService.joinCohort(user.userId, cohortId, sessionId, pin);
    if (joined) {
      this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
      this.pubSub.publish('studentsUpdated', { onStudentsUpdated: true });
    }
    return joined;
  }

  @Query(() => CompanyProfile)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async companyProfile(@CurrentUser() user: any) {
    return this.cohortService.getCompanyProfile(user.userId);
  }

  @Mutation(() => CompanyProfile)
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles('COORDINATOR', 'SUPER_ADMIN', 'ADMIN')
  async updateCompanyProfile(
    @CurrentUser() user: any,
    @Args('companyName', { nullable: true }) companyName?: string,
    @Args('companyEmail', { nullable: true }) companyEmail?: string,
    @Args('companyPhone', { nullable: true }) companyPhone?: string,
    @Args('adminName', { nullable: true }) adminName?: string,
    @Args('username', { nullable: true }) username?: string,
  ) {
    return this.cohortService.updateCompanyProfile(user.userId, companyName, companyEmail, companyPhone, adminName, username);
  }

  @Subscription(() => Boolean)
  onCohortsUpdated() {
    return this.pubSub.asyncIterableIterator('cohortsUpdated');
  }

  @ResolveField(() => CohortSession, { nullable: true })
  async joinedSession(@Parent() cohort: Cohort, @CurrentUser() user: any) {
    if (!user) return null;
    return this.cohortService.getJoinedSession(user.userId, cohort.id);
  }
}
