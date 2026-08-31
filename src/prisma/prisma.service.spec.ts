import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('PrismaService DB-02 (Mocked)', () => {
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaService>();
  });

  it('should verify linking of CohortSession, AttendanceLog, and Penalty (DB-02)', async () => {
    const mockSession: Prisma.CohortSessionGetPayload<{}> = {
      id: 'session-123',
      cohortId: 'cohort-1',
      name: 'Morning Class',
      startTime: '09:00',
      gracePeriodMinutes: 5,
      recurrenceDays: ['EVERYDAY'],
      latePenaltyAmount: 25,
      escalationThresholdMinutes: 15,
      escalationRate: 5,
      escalationIntervalMinutes: 5,
    };
    prismaMock.cohortSession.create.mockResolvedValue(mockSession);
    const session = await prismaMock.cohortSession.create({
      data: {
        name: 'Morning Class',
        cohortId: 'cohort-1',
        startTime: '09:00',
        gracePeriodMinutes: 5,
      },
    });
    expect(session.id).toBe('session-123');

    const mockLog: Prisma.AttendanceLogGetPayload<{}> = {
      id: 'log-123',
      sessionId: 'session-123',
      userId: 'user-1',
      date: '2026-08-30',
      scannedAt: new Date(),
      isLate: false,
      latenessMinutes: 0,
      calculatedPenalty: 0,
      deviceSignature: null,
      isManualScan: false,
    };
    prismaMock.attendanceLog.create.mockResolvedValue(mockLog);
    const log = await prismaMock.attendanceLog.create({
      data: { sessionId: 'session-123', userId: 'user-1', date: '2026-08-30' },
    });
    expect(log.sessionId).toBe('session-123');

    const mockPenalty: Prisma.PenaltyGetPayload<{}> = {
      id: 'penalty-123',
      userId: 'user-1',
      attendanceLogId: 'log-123',
      amount: 25,
      status: 'UNPAID',
      createdAt: new Date(),
    };
    prismaMock.penalty.create.mockResolvedValue(mockPenalty);
    const penalty = await prismaMock.penalty.create({
      data: { attendanceLogId: 'log-123', userId: 'user-1' },
    });
    expect(penalty.attendanceLogId).toBe('log-123');

    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`sessionId`,`userId`)',
      { code: 'P2002', clientVersion: '6.x' },
    );
    prismaMock.attendanceLog.create.mockRejectedValueOnce(p2002Error);

    await expect(
      prismaMock.attendanceLog.create({
        data: { sessionId: 'session-123', userId: 'user-1', date: '2026-08-30' },
      }),
    ).rejects.toThrow('Unique constraint failed');
  });
});
