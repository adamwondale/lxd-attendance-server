import { Test, TestingModule } from '@nestjs/testing';
import { CohortService } from './cohort.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException } from '@nestjs/common';

describe('CohortService (TDD)', () => {
  let service: CohortService;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [CohortService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = testingModule.get<CohortService>(CohortService);
  });

  describe('createCohortSession', () => {
    it('throws BadRequestException if the cohort does not exist', async () => {
      prismaMock.cohort.findFirst.mockResolvedValue(null);
      await expect(service.createCohortSession('tenant-1', 'invalid', 'Test Session', '09:00', 15, ['EVERYDAY'], 50))
        .rejects.toThrow(BadRequestException);
    });

    it('creates a cohort session correctly', async () => {
      prismaMock.cohort.findFirst.mockResolvedValue({ id: 'c1', tenantId: 't1' } as any);
      prismaMock.cohortSession.create.mockResolvedValue({ id: 's1' } as any);

      const result = await service.createCohortSession('t1', 'c1', 'S1', '09:00', 15, ['EVERYDAY'], 50);
      expect(result.id).toBe('s1');
      expect(prismaMock.cohortSession.create).toHaveBeenCalledWith({
        data: {
          cohortId: 'c1',
          name: 'S1',
          startTime: '09:00',
          gracePeriodMinutes: 15,
          recurrenceDays: ['EVERYDAY'],
          latePenaltyAmount: 50,
          escalationThresholdMinutes: 15,
          escalationRate: 5,
          escalationIntervalMinutes: 5,
        }
      });
    });
  });

  describe('updateCohortSession', () => {
    it('throws BadRequestException if the session does not exist', async () => {
      prismaMock.cohortSession.findFirst.mockResolvedValue(null);
      await expect(service.updateCohortSession('tenant-1', 'invalid', 'New Name'))
        .rejects.toThrow(BadRequestException);
    });

    it('updates a cohort session correctly', async () => {
      prismaMock.cohortSession.findFirst.mockResolvedValue({ id: 's1', cohortId: 'c1' } as any);
      prismaMock.cohortSession.update.mockResolvedValue({ id: 's1', name: 'New Name' } as any);

      const result = await service.updateCohortSession('t1', 's1', 'New Name', '10:00', undefined, undefined, 75);
      expect(result.id).toBe('s1');
      expect(prismaMock.cohortSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: {
          name: 'New Name',
          startTime: '10:00',
          latePenaltyAmount: 75,
        }
      });
    });
  });

  describe('deleteCohortSession', () => {
    it('throws BadRequestException if the session does not exist', async () => {
      prismaMock.cohortSession.findFirst.mockResolvedValue(null);
      await expect(service.deleteCohortSession('tenant-1', 'invalid'))
        .rejects.toThrow(BadRequestException);
    });

    it('deletes a cohort session correctly', async () => {
      prismaMock.cohortSession.findFirst.mockResolvedValue({ id: 's1', cohortId: 'c1' } as any);
      prismaMock.cohortSession.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteCohortSession('t1', 's1');
      expect(result).toBe(true);
      expect(prismaMock.cohortSession.deleteMany).toHaveBeenCalledWith({
        where: { id: 's1', cohort: { tenantId: 't1' } }
      });
    });
  });

  describe('createCohort', () => {
    it('rejects an end date before the start date', async () => {
      await expect(
        service.createCohort('t1', 'C1', '1234', new Date('2026-06-01'), new Date('2026-05-01')),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.cohort.create).not.toHaveBeenCalled();
    });

    it('calculates and stores duration from the selected dates', async () => {
      prismaMock.cohort.findUnique.mockResolvedValue(null);
      prismaMock.cohort.create.mockResolvedValue({ id: 'c1' } as any);

      const result = await service.createCohort(
        't1', 'C1', '1234', new Date('2026-01-01'), new Date('2026-04-01'),
      );
      expect(result.id).toBe('c1');
      expect(prismaMock.cohort.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ durationMonths: 3 }),
      });
    });
  });
});
