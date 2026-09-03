import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class DashboardMetrics {
  @Field(() => Int) activeCohorts!: number;
  @Field(() => Int) totalStudents!: number;
  @Field(() => Int) presentToday!: number;
  @Field(() => Int) absentToday!: number;
  @Field(() => Int) lateToday!: number;
  @Field(() => Float) todayRevenue!: number;
}

@ObjectType()
export class CompanyProfile {
  @Field() id!: string;
  @Field() companyName!: string;
  @Field({ nullable: true }) companyEmail?: string;
  @Field({ nullable: true }) companyPhone?: string;
  @Field({ nullable: true }) adminName?: string;
  @Field({ nullable: true }) username?: string;
  @Field() timezone!: string;
}
