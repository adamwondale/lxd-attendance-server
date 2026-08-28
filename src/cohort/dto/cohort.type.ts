import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

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

  @Field(() => Int)
  durationMonths: number;

  @Field(() => Int)
  latePenaltyAmount: number;

  @Field()
  isActive: boolean;
}
