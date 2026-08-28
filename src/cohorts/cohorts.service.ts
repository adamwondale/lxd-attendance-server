import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CohortsService {
  constructor(private readonly prisma: PrismaService) {}

  async joinCohort(userId: string, pin: string) {
    const cohort = await this.prisma.cohort.findUnique({
      where: { pin },
    });

    if (!cohort) {
      throw new NotFoundException('Cohort not found');
    }

    try {
      return await this.prisma.cohortMembership.create({
        data: {
          cohortId: cohort.id,
          userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Idempotency: Ignore duplicate creation and return existing record
        const existing = await this.prisma.cohortMembership.findUnique({
          where: {
            cohortId_userId: {
              cohortId: cohort.id,
              userId,
            },
          },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }
}
