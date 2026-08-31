import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req?.user;
  },
);
