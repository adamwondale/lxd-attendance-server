import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class DashboardMetrics {
  @Field(() => Int)
  activeCohorts: number;

  @Field(() => Int)
  totalStudents: number;

  @Field(() => Float)
  todayRevenue: number;
}
