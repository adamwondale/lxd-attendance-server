import { Resolver, Mutation, Query, Args, Int, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { Cohort } from './dto/cohort.type';
import { DashboardMetrics } from './dto/dashboard.type';
import { CohortService } from './cohort.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver()
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
    @Args('durationMonths', { type: () => Int }) durationMonths: number,
    @Args('latePenaltyAmount', { type: () => Int }) latePenaltyAmount: number,
  ) {
    const cohort = await this.cohortService.createCohort(
      user.userId,
      name,
      pin,
      durationMonths,
      latePenaltyAmount
    );
    this.pubSub.publish('cohortsUpdated', { onCohortsUpdated: true });
    return cohort.id;
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
    @Args('pin') pin: string,
  ) {
    const joined = await this.cohortService.joinCohort(user.userId, cohortId, pin);
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
}
