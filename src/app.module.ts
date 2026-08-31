import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { Request } from 'express';

type GraphQLWsExtra = { request?: Request };
type GraphQLContext = { req?: Request; extra?: GraphQLWsExtra };

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
      context: ({ req, extra }: GraphQLContext) => ({
        req: req ?? extra?.request,
      }),
      subscriptions: {
        'graphql-ws': {
          onConnect: (ctx: any) => {
            const { connectionParams, extra } = ctx;
            const authorization = connectionParams?.authorization;
            if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
              throw new Error('Unauthorized');
            }
            extra.request = {
              headers: { authorization },
            } as Request;
          },
        },
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
