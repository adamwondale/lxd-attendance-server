import { ObjectType, Field, ID } from '@nestjs/graphql';
import { CohortMembership } from '../../cohort/dto/cohort.type';

@ObjectType()
export class User {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  username?: string;

  @Field(() => [CohortMembership], { nullable: true })
  memberships?: CohortMembership[];
}
