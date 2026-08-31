import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class CohortMembership {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  cohortId: string;

  @Field({ nullable: true })
  sessionId?: string;

  @Field()
  status: string;

  @Field(() => Cohort, { nullable: true })
  cohort?: any;

  @Field(() => CohortSession, { nullable: true })
  session?: any;
}

@ObjectType()
export class CohortSession {
  @Field(() => ID)
  id: string;

  @Field()
  cohortId: string;

  @Field()
  name: string;

  @Field()
  startTime: string;

  @Field(() => Int)
  gracePeriodMinutes: number;

  @Field(() => [String])
  recurrenceDays: string[];

  @Field(() => Int)
  latePenaltyAmount: number;

  @Field(() => Int)
  escalationThresholdMinutes: number;

  @Field(() => Int)
  escalationRate: number;

  @Field(() => Int)
  escalationIntervalMinutes: number;
}

@ObjectType()
export class Cohort {
  @Field(() => ID)
  id: string;

  @Field()
  tenantId: string;

  @Field()
  name: string;

  @Field()
  startDate: Date;

  @Field()
  pin: string;

  @Field(() => Date)
  endDate: Date;

  @Field()
  isActive: boolean;

  @Field(() => Int, { nullable: true })
  durationMonths?: number;

  @Field(() => [CohortSession], { nullable: true })
  sessions?: CohortSession[];

  @Field(() => CohortSession, { nullable: true })
  joinedSession?: CohortSession;
}

@ObjectType()
export class PublicCohort {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => Date)
  startDate: Date;

  @Field(() => Date)
  endDate: Date;

  @Field()
  isActive: boolean;

  @Field(() => Int, { nullable: true })
  durationMonths?: number;

  @Field(() => [CohortSession], { nullable: true })
  sessions?: CohortSession[];

  @Field(() => CohortSession, { nullable: true })
  joinedSession?: CohortSession;
}
