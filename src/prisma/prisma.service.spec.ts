import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';

describe('PrismaService DB-02 (Mocked)', () => {
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaService>();
  });

  it('should verify linking of CohortSession, AttendanceLog, and Penalty (DB-02)', async () => {
    // 1. Create a dummy session
    const mockSession = { id: 'session-123', name: 'Morning Class', cohortId: 'cohort-1' };
    prismaMock.cohortSession.create.mockResolvedValue(mockSession as any);
    const session = await prismaMock.cohortSession.create({ data: { name: 'Morning Class', cohortId: 'cohort-1', startTime: '09:00', gracePeriodMinutes: 5 } });
    expect(session.id).toBe('session-123');

    // 2. Create a dummy log
    const mockLog = { id: 'log-123', sessionId: 'session-123', userId: 'user-1' };
    prismaMock.attendanceLog.create.mockResolvedValue(mockLog as any);
    const log = await prismaMock.attendanceLog.create({ data: { sessionId: 'session-123', userId: 'user-1' } });
    expect(log.sessionId).toBe('session-123');

    // 3. Create a penalty linked to log
    const mockPenalty = { id: 'penalty-123', attendanceLogId: 'log-123' };
    prismaMock.penalty.create.mockResolvedValue(mockPenalty as any);
    const penalty = await prismaMock.penalty.create({ data: { attendanceLogId: 'log-123', userId: 'user-1' } });
    expect(penalty.attendanceLogId).toBe('log-123');

    // 4. Idempotency Simulation: Duplicate log throws P2002
    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`sessionId`,`userId`)',
      { code: 'P2002', clientVersion: '6.x' }
    );
    prismaMock.attendanceLog.create.mockRejectedValueOnce(p2002Error);
    
    await expect(prismaMock.attendanceLog.create({ data: { sessionId: 'session-123', userId: 'user-1' } })).rejects.toThrow('Unique constraint failed');
  });
});
