import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QrModule } from './qr/qr.module';
import { CohortModule } from './cohort/cohort.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PubSubModule } from './pubsub/pubsub.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({ req }: any) => ({ req }),
      subscriptions: {
        'graphql-ws': true,
      },
    }),
    PrismaModule,
    PubSubModule,
    AuthModule,
    UsersModule,
    QrModule,
    CohortModule,
    AttendanceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
