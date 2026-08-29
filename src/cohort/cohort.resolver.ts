import { Resolver, Mutation, Query, Args, Int, Subscription, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Cohort, CohortSession } from './dto/cohort.type';
import { DashboardMetrics } from './dto/dashboard.type';
import { CohortService } from './cohort.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver(() => Cohort)
export class CohortResolver {
  constructor(
    private readonly cohortService: CohortService,
    @Inject('PUB_SUB') private pubSub: PubSub
  ) {}

  @Mutation(() => String) 
  @UseGuards(GqlAuthGuard, RolesGuard)
  async createCohort(
    @CurrentUser() user: any,
    @Args('name') name: string,
    @Args('pin') pin: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ) {
    const cohort = await this.cohortService.createCohort(
      user.userId,
      name,
      pin,
      new Date(startDate),
      new Date(endDate)
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return cohort.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async updateCohort(
    @Args('cohortId') cohortId: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('pin', { nullable: true }) pin?: string,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('endDate', { nullable: true }) endDate?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ) {
    const cohort = await this.cohortService.updateCohort(
      cohortId,
      name,
      pin,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      isActive
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return cohort.id;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
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
  async createCohortSession(
    @Args('cohortId') cohortId: string,
    @Args('name') name: string,
    @Args('startTime') startTime: string,
    @Args('gracePeriodMinutes', { type: () => Int }) gracePeriodMinutes: number,
    @Args('recurrenceDays', { type: () => [String] }) recurrenceDays: string[],
    @Args('latePenaltyAmount', { type: () => Int }) latePenaltyAmount: number,
  ) {
    const session = await this.cohortService.createCohortSession(
      cohortId,
      name,
      startTime,
      gracePeriodMinutes,
      recurrenceDays,
      latePenaltyAmount
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return session.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async updateCohortSession(
    @Args('sessionId') sessionId: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('gracePeriodMinutes', { type: () => Int, nullable: true }) gracePeriodMinutes?: number,
    @Args('recurrenceDays', { type: () => [String], nullable: true }) recurrenceDays?: string[],
    @Args('latePenaltyAmount', { type: () => Int, nullable: true }) latePenaltyAmount?: number,
  ) {
    const session = await this.cohortService.updateCohortSession(
      sessionId,
      name,
      startTime,
      gracePeriodMinutes,
      recurrenceDays,
      latePenaltyAmount
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return session.id;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
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
  async listCohorts(@CurrentUser() user: any) {
    return this.cohortService.listCohorts(user.userId);
  }

  @Query(() => Cohort, { nullable: true })
  @UseGuards(GqlAuthGuard, RolesGuard)
  async cohortDetails(@Args('id') id: string) {
    return this.cohortService.getCohortDetails(id);
  }

  @Query(() => DashboardMetrics)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async dashboardMetrics(@CurrentUser() user: any) {
    return this.cohortService.getDashboardMetrics(user.userId);
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
