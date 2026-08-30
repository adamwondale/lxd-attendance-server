import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      cohortMembership: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('adminEnrollStudent', () => {
    it('should enroll a student in a cohort with a specific session', async () => {
      prismaMock.cohortMembership.create.mockResolvedValue({ id: 'mem-1', userId: 'user-1', cohortId: 'cohort-1', sessionId: 'session-1', status: 'ACTIVE' });
      
      const result = await service.adminEnrollStudent('user-1', 'cohort-1', 'session-1');
      
      expect(prismaMock.cohortMembership.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          cohortId: 'cohort-1',
          sessionId: 'session-1',
          status: 'ACTIVE',
        },
      });
      expect(result.id).toBe('mem-1');
    });
  });

  describe('adminUpdateStudentMembership', () => {
    it('should update the session of an existing cohort membership', async () => {
      prismaMock.cohortMembership.update.mockResolvedValue({ id: 'mem-1', userId: 'user-1', cohortId: 'cohort-1', sessionId: 'session-2', status: 'ACTIVE' });
      
      const result = await service.adminUpdateStudentMembership('user-1', 'cohort-1', 'session-2');
      
      expect(prismaMock.cohortMembership.update).toHaveBeenCalledWith({
        where: {
          cohortId_userId: {
            userId: 'user-1',
            cohortId: 'cohort-1',
          }
        },
        data: {
          sessionId: 'session-2',
        },
      });
      expect(result.sessionId).toBe('session-2');
    });
  });

  describe('adminRemoveStudentFromCohort', () => {
    it('should delete the cohort membership', async () => {
      prismaMock.cohortMembership.delete.mockResolvedValue({ id: 'mem-1' });
      
      const result = await service.adminRemoveStudentFromCohort('user-1', 'cohort-1');
      
      expect(prismaMock.cohortMembership.delete).toHaveBeenCalledWith({
        where: {
          cohortId_userId: {
            userId: 'user-1',
            cohortId: 'cohort-1',
          }
        }
      });
      expect(result).toBe(true);
    });
  });
});
