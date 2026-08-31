import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('AttendanceService (ATTEND tests)', () => {
  let service: AttendanceService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let qrServiceMock: jest.Mocked<QrService>;

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaService>();
    qrServiceMock = {
      generateQr: jest.fn(),
      verifyQr: jest.fn(),
      verifyStudentQr: jest.fn(),
    } as any;

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QrService, useValue: qrServiceMock },
      ],
    }).compile();

    service = testingModule.get<AttendanceService>(AttendanceService);
  });

  const userId = 'student-1';
  const sessionId = 'session-123';
  const validQr = `${sessionId}.123456.signature`;
  
  const mockLog = {
    id: 'log-1',
    sessionId,
    userId,
    scannedAt: new Date(),
    isLate: false,
  };

  const mockSessionBase = {
    id: sessionId,
    startTime: '09:00',
    gracePeriodMinutes: 5,
    recurrenceDays: ['EVERYDAY'],
  };

  beforeEach(() => {
    prismaMock.cohortSession.findUnique.mockResolvedValue({
      ...mockSessionBase,
      cohort: { latePenaltyAmount: 25 },
    } as any);
    prismaMock.cohortMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      sessionId,
      userId,
      cohortId: 'cohort-1',
      status: 'ACTIVE',
      session: {
        ...mockSessionBase,
        cohort: {
          tenantId: 'tenant1',
          timezone: 'Africa/Addis_Ababa',
          latePenaltyAmount: 25,
        },
      },
    } as any);
  });

  describe('logAttendance (Scenario A)', () => {
    it('ATTEND-01: Valid QR code logs attendance successfully', async () => {
      qrServiceMock.verifyQr.mockReturnValue(true);
      prismaMock.attendanceLog.create.mockResolvedValue(mockLog as any);
      prismaMock.attendanceLog.findUnique.mockResolvedValueOnce(null).mockResolvedValue(mockLog as any);

      const result = await service.logAttendance(userId, validQr);

      expect(qrServiceMock.verifyQr).toHaveBeenCalledWith(validQr, sessionId);
      expect(prismaMock.attendanceLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sessionId, userId }),
      });
      expect(result).toEqual(mockLog);
    });

    it('ATTEND-01b: Throws BadRequestException if session does not exist (No Demo Fallback)', async () => {
      qrServiceMock.verifyQr.mockReturnValue(true);
      prismaMock.cohortMembership.findUnique.mockResolvedValue(null);
      prismaMock.cohortSession.findUnique.mockResolvedValue(null);

      await expect(service.logAttendance(userId, validQr)).rejects.toThrow(BadRequestException);
      expect(prismaMock.cohort.findUnique).not.toHaveBeenCalled();
      prismaMock.cohortMembership.findUnique.mockResolvedValue({
        sessionId,
        session: null
      } as any);

      await expect(service.logAttendance(userId, validQr)).rejects.toThrow(BadRequestException);
    });

    it('ATTEND-04: Duplicate scan (P2002) is handled gracefully', async () => {
      qrServiceMock.verifyQr.mockReturnValue(true);
      
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.x' }
      );
      prismaMock.attendanceLog.create.mockRejectedValue(p2002Error);
      prismaMock.attendanceLog.findUnique.mockResolvedValue(mockLog as any);

      const result = await service.logAttendance(userId, validQr);

      expect(result).toEqual(mockLog);
      expect(prismaMock.attendanceLog.findUnique).toHaveBeenCalledWith({
        where: { sessionId_userId_date: { sessionId, userId, date: expect.any(String) } },
      });
    });
  });

  describe('Lateness Penalty Engine (Phase 5)', () => {
    const mockSessionBase = {
        id: sessionId,
        startTime: '09:00',
        gracePeriodMinutes: 5,
        recurrenceDays: ['EVERYDAY'],
        latePenaltyAmount: 25,
        cohort: { tenantId: 'tenant1' },
    };

    beforeEach(() => {
      qrServiceMock.verifyQr.mockReturnValue(true);
      // We'll set the system time relative to UTC.
      // Africa/Addis_Ababa is UTC+3.
      // So 09:00 local is 06:00 UTC.
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('PENALTY-01: On-time scan does not trigger penalty', async () => {
      // Set time to 06:04:00 UTC (09:04:00 local) -> On time
      jest.setSystemTime(new Date('2026-08-28T06:04:00Z'));
      
      prismaMock.cohortMembership.findUnique.mockResolvedValue({
        sessionId,
        session: {
          ...mockSessionBase,
          cohort: { latePenaltyAmount: 25 },
        },
      } as any);
      
      prismaMock.attendanceLog.create.mockResolvedValue(mockLog as any);

      await service.logAttendance(userId, validQr);

      expect(prismaMock.attendanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isLate: false }),
        })
      );
      expect(prismaMock.penalty.create).not.toHaveBeenCalled();
    });

    it('PENALTY-02: Late scan sets isLate=true and generates Penalty', async () => {
      // Set time to 06:06:00 UTC (09:06:00 local) -> Late
      jest.setSystemTime(new Date('2026-08-28T06:06:00Z'));

      prismaMock.cohortMembership.findUnique.mockResolvedValue({
        sessionId,
        session: {
          ...mockSessionBase,
          cohort: { latePenaltyAmount: 25 },
        },
      } as any);
      
      prismaMock.attendanceLog.create.mockResolvedValue({ ...mockLog, id: 'log-late', isLate: true } as any);

      await service.logAttendance(userId, validQr);

      expect(prismaMock.attendanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isLate: true }),
        })
      );
      expect(prismaMock.penalty.create).toHaveBeenCalledWith({
        data: {
          attendanceLogId: 'log-late',
          userId: userId,
          amount: 25,
        },
      });
    });

    it('PENALTY-03: Late scan in free cohort sets isLate=true but skips Penalty', async () => {
      // Set time to 06:06:00 UTC (09:06:00 local) -> Late
      jest.setSystemTime(new Date('2026-08-28T06:06:00Z'));

      prismaMock.cohortMembership.findUnique.mockResolvedValue({
        sessionId,
        session: {
          ...mockSessionBase,
          latePenaltyAmount: 0,
          cohort: { tenantId: 'tenant1' },
        },
      } as any);
      
      prismaMock.attendanceLog.create.mockResolvedValue({ ...mockLog, id: 'log-free', isLate: true } as any);

      await service.logAttendance(userId, validQr);

      expect(prismaMock.attendanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isLate: true }),
        })
      );
      expect(prismaMock.penalty.create).not.toHaveBeenCalled();
    });
  });

  describe('Tenant isolation for administrative mutations', () => {
    it('rejects waivePenalty for another tenant', async () => {
      prismaMock.penalty.findFirst.mockResolvedValue(null);

      await expect(service.waivePenalty('penalty-1', 'tenant-1')).rejects.toThrow(
        'Penalty is not accessible for this tenant.',
      );
      expect(prismaMock.penalty.update).not.toHaveBeenCalled();
    });

    it('rejects adminLogAttendance when the session is outside the tenant', async () => {
      prismaMock.cohortSession.findFirst.mockResolvedValue(null);

      await expect(
        service.adminLogAttendance('tenant-1', 'student-1', 'session-1'),
      ).rejects.toThrow('Session is not accessible for this tenant.');
      expect(prismaMock.attendanceLog.create).not.toHaveBeenCalled();
    });

    it('rejects adminScanStudentBadge when the student has no membership in the tenant', async () => {
      qrServiceMock.verifyQr.mockReturnValue(true);
      qrServiceMock.verifyStudentQr.mockReturnValue('student-1');
      prismaMock.cohortMembership.findMany.mockResolvedValue([]);

      await expect(
        service.adminScanStudentBadge('tenant-1', 'student-1.signature'),
      ).rejects.toThrow('Student is not enrolled in any active cohorts.');
    });
  });

  describe('adminLogAttendance (Scenario B)', () => {
    it('ATTEND-02: Admin logs attendance for specific student', async () => {
      prismaMock.attendanceLog.create.mockResolvedValue(mockLog as any);

      const result = await service.adminLogAttendance(userId, sessionId);

      expect(qrServiceMock.verifyQr).not.toHaveBeenCalled();
      expect(prismaMock.attendanceLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sessionId, userId }),
      });
      expect(result).toEqual(mockLog);
    });
  });

  describe('getAttendanceLogs', () => {
    it('ATTEND-05: Can filter logs by sessionId', async () => {
      prismaMock.attendanceLog.findMany.mockResolvedValue([mockLog as any]);

      const result = await service.getAttendanceLogs(undefined, 'session-123');

      expect(prismaMock.attendanceLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'session-123' },
        })
      );
      expect(result).toEqual([mockLog]);
    });
  });
});
