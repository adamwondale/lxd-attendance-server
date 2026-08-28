import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class UserReference {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  email?: string;
}

@ObjectType()
export class Penalty {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  amount: number;

  @Field()
  status: string; // UNPAID, PAID, WAIVED
}

@ObjectType()
export class AttendanceLog {
  @Field(() => ID)
  id: string;

  @Field()
  scannedAt: Date;

  @Field()
  isLate: boolean;

  @Field(() => UserReference)
  user: UserReference;

  @Field(() => Penalty, { nullable: true })
  penalty?: Penalty;
}
