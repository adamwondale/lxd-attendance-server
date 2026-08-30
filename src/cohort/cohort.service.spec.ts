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
    const module: TestingModule = await Test.createTestingModule({
      providers: [CohortService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get<CohortService>(CohortService);
  });

  describe('createCohortSession', () => {
    it('throws BadRequestException if the cohort does not exist', async () => {
      prismaMock.cohort.findUnique.mockResolvedValue(null);
      await expect(service.createCohortSession('invalid', 'Test Session', '09:00', 15, ['EVERYDAY'], 50))
        .rejects.toThrow(BadRequestException);
    });

    it('creates a cohort session correctly', async () => {
      prismaMock.cohort.findUnique.mockResolvedValue({ id: 'c1' } as any);
      prismaMock.cohortSession.create.mockResolvedValue({ id: 's1' } as any);

      const result = await service.createCohortSession('c1', 'S1', '09:00', 15, ['EVERYDAY'], 50);
      expect(result.id).toBe('s1');
      expect(prismaMock.cohortSession.create).toHaveBeenCalledWith({
        data: {
          cohortId: 'c1',
          name: 'S1',
          startTime: '09:00',
          gracePeriodMinutes: 15,
          recurrenceDays: ['EVERYDAY'],
          latePenaltyAmount: 50,
        }
      });
    });
  });

  describe('updateCohortSession', () => {
    it('throws BadRequestException if the session does not exist', async () => {
      prismaMock.cohortSession.findUnique.mockResolvedValue(null);
      await expect(service.updateCohortSession('invalid', 'New Name'))
        .rejects.toThrow(BadRequestException);
    });

    it('updates a cohort session correctly', async () => {
      prismaMock.cohortSession.findUnique.mockResolvedValue({ id: 's1' } as any);
      prismaMock.cohortSession.update.mockResolvedValue({ id: 's1', name: 'New Name' } as any);

      const result = await service.updateCohortSession('s1', 'New Name', '10:00', undefined, undefined, 75);
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
      prismaMock.cohortSession.findUnique.mockResolvedValue(null);
      await expect(service.deleteCohortSession('invalid'))
        .rejects.toThrow(BadRequestException);
    });

    it('deletes a cohort session correctly', async () => {
      prismaMock.cohortSession.findUnique.mockResolvedValue({ id: 's1' } as any);
      prismaMock.cohortSession.delete.mockResolvedValue({ id: 's1' } as any);

      const result = await service.deleteCohortSession('s1');
      expect(result).toBe(true);
      expect(prismaMock.cohortSession.delete).toHaveBeenCalledWith({
        where: { id: 's1' }
      });
    });
  });

  describe('createCohort', () => {
    it('creates a cohort successfully', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', tenants: [{ tenantId: 't1' }] } as any);
      prismaMock.cohort.findUnique.mockResolvedValue(null);
      prismaMock.cohort.create.mockResolvedValue({ id: 'c1' } as any);

      const startDate = new Date();
      const endDate = new Date();
      const result = await service.createCohort('u1', 'C1', '1234', startDate, endDate);
      expect(result.id).toBe('c1');
    });
  });
});
