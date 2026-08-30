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
  status: string;
}

@ObjectType()
export class AttendanceLog {
  @Field(() => ID)
  id: string;

  @Field()
  date: string;

  @Field()
  scannedAt: Date;

  @Field()
  isLate: boolean;

  @Field(() => Int)
  latenessMinutes: number;

  @Field(() => Int)
  calculatedPenalty: number;

  @Field()
  isManualScan: boolean;

  @Field(() => UserReference)
  user: UserReference;

  @Field(() => Penalty, { nullable: true })
  penalty?: Penalty;
}

@ObjectType()
export class AttendanceEvent {
  @Field(() => ID)
  id: string;

  @Field()
  cohortId: string;

  @Field()
  sessionId: string;

  @Field()
  date: string;

  @Field()
  scannedAt: Date;

  @Field(() => UserReference)
  user: UserReference;

  @Field()
  isLate: boolean;

  @Field(() => Int)
  latenessMinutes: number;

  @Field(() => Int)
  calculatedPenalty: number;
}

@ObjectType()
export class AttendanceReportRow {
  @Field(() => ID)
  id: string;

  @Field()
  date: string;

  @Field()
  status: string;

  @Field()
  traineeId: string;

  @Field()
  traineeName: string;

  @Field({ nullable: true })
  sessionName?: string;

  @Field({ nullable: true })
  cohortName?: string;

  @Field(() => Int)
  latenessMinutes: number;

  @Field(() => Int)
  penalty: number;
}

@ObjectType()
export class StudentAttendanceSummary {
  @Field(() => Int) presentDays: number;
  @Field(() => Int) lateDays: number;
  @Field(() => Int) totalPenalty: number;
  @Field(() => [AttendanceLog]) lateLogs: AttendanceLog[];
}
