import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CohortActiveGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const args = ctx.getArgs();
    
    // Assume cohortId is passed in args. It could be nested, but we check top-level for now.
    const cohortId = args.cohortId;
    
    if (!cohortId) {
      return true; // Or throw error, but if no cohortId is present, maybe it's not a cohort-specific route.
    }

    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
    });

    if (!cohort) {
      throw new ForbiddenException('Cohort not found');
    }

    if (!cohort.isActive) {
      throw new ForbiddenException('COHORT_CYCLE_COMPLETED');
    }

    // Check if the cohort's end date has passed
    if (new Date() > cohort.endDate) {
      throw new ForbiddenException('COHORT_CYCLE_COMPLETED');
    }

    return true;
  }
}
