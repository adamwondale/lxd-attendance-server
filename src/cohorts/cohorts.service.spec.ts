import { Test, TestingModule } from '@nestjs/testing';
import { CohortsService } from './cohorts.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('CohortsService (MEM tests)', () => {
  let service: CohortsService;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CohortsService>(CohortsService);
  });

  describe('joinCohort', () => {
    const userId = 'user-123';
    const validPin = 'VALID_PIN';
    const invalidPin = 'INVALID_PIN';
    const cohortId = 'cohort-456';
    const membershipId = 'membership-789';
    
    const mockCohort = {
      id: cohortId,
      tenantId: 'tenant-1',
      name: 'Test Cohort',
      pin: validPin,
      duration: '3_MONTHS',
      settlementDeadline: '2026-12-31',
    };

    const mockMembership = {
      id: membershipId,
      cohortId: cohortId,
      userId: userId,
      joinedAt: new Date(),
    };

    it('MEM-01: Valid PIN -> creates CohortMembership', async () => {
      prismaMock.cohort.findUnique.mockResolvedValue(mockCohort as any);
      prismaMock.cohortMembership.create.mockResolvedValue(mockMembership as any);

      const result = await service.joinCohort(userId, validPin);
      
      expect(prismaMock.cohort.findUnique).toHaveBeenCalledWith({ where: { pin: validPin } });
      expect(prismaMock.cohortMembership.create).toHaveBeenCalledWith({
        data: {
          cohortId,
          userId,
        },
      });
      expect(result).toEqual(mockMembership);
    });

    it('MEM-02: Duplicate PIN submit -> catches P2002 error gracefully, returns existing membership', async () => {
      prismaMock.cohort.findUnique.mockResolvedValue(mockCohort as any);
      
      // Simulate P2002 error on create
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.x' }
      );
      prismaMock.cohortMembership.create.mockRejectedValue(p2002Error);
      
      // When it fails, it should fetch the existing membership
      prismaMock.cohortMembership.findUnique.mockResolvedValue(mockMembership as any);

      const result = await service.joinCohort(userId, validPin);
      
      expect(result).toEqual(mockMembership);
      expect(prismaMock.cohortMembership.findUnique).toHaveBeenCalledWith({
        where: {
          cohortId_userId: { cohortId, userId }
        }
      });
    });

    it('MEM-03: Invalid PIN -> throws 404 Not Found', async () => {
      prismaMock.cohort.findUnique.mockResolvedValue(null);

      await expect(service.joinCohort(userId, invalidPin)).rejects.toThrow(NotFoundException);
    });
  });
});
