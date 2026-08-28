import { Test, TestingModule } from '@nestjs/testing';
import { CohortActiveGuard } from './cohort-active.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { GqlExecutionContext } from '@nestjs/graphql';

// Mock GqlExecutionContext
jest.mock('@nestjs/graphql', () => {
  return {
    GqlExecutionContext: {
      create: jest.fn(),
    },
  };
});

describe('CohortActiveGuard (GUARD-01)', () => {
  let guard: CohortActiveGuard;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortActiveGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    guard = module.get<CohortActiveGuard>(CohortActiveGuard);
  });

  const createMockContext = (cohortId: string) => {
    const mockContext = {
      getArgs: () => ({ cohortId }),
    };
    (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockContext);
    return {} as ExecutionContext;
  };

  it('should allow access if cohort is active and within duration', async () => {
    const ctx = createMockContext('valid-cohort');
    
    // Cohort started 1 month ago, duration is 3 months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    prismaMock.cohort.findUnique.mockResolvedValue({
      id: 'valid-cohort',
      isActive: true,
      startDate: startDate,
      durationMonths: 3,
    } as any);

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if cohort isActive is false', async () => {
    const ctx = createMockContext('inactive-cohort');
    
    prismaMock.cohort.findUnique.mockResolvedValue({
      id: 'inactive-cohort',
      isActive: false,
      startDate: new Date(),
      durationMonths: 3,
    } as any);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('COHORT_CYCLE_COMPLETED');
  });

  it('should throw ForbiddenException if cohort is expired based on date', async () => {
    const ctx = createMockContext('expired-cohort');
    
    // Cohort started 4 months ago, duration is 3 months -> EXPIRED
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 4);
    
    prismaMock.cohort.findUnique.mockResolvedValue({
      id: 'expired-cohort',
      isActive: true,
      startDate: startDate,
      durationMonths: 3,
    } as any);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('COHORT_CYCLE_COMPLETED');
  });
});
