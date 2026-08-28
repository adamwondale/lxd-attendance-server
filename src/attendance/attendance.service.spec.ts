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
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QrService, useValue: qrServiceMock },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
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
  };

  beforeEach(() => {
    prismaMock.cohortSession.findUnique.mockResolvedValue({
      ...mockSessionBase,
      cohort: { latePenaltyAmount: 25 },
    } as any);
  });

  describe('logAttendance (Scenario A)', () => {
    it('ATTEND-01: Valid QR code logs attendance successfully', async () => {
      qrServiceMock.verifyQr.mockReturnValue(true);
      prismaMock.attendanceLog.create.mockResolvedValue(mockLog as any);

      const result = await service.logAttendance(userId, validQr);

      expect(qrServiceMock.verifyQr).toHaveBeenCalledWith(validQr, sessionId);
      expect(prismaMock.attendanceLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sessionId, userId }),
      });
      expect(result).toEqual(mockLog);
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
        where: { sessionId_userId: { sessionId, userId } },
      });
    });
  });

  describe('Lateness Penalty Engine (Phase 5)', () => {
    const mockSessionBase = {
      id: sessionId,
      startTime: '09:00',
      gracePeriodMinutes: 5,
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
      
      prismaMock.cohortSession.findUnique.mockResolvedValue({
        ...mockSessionBase,
        cohort: { latePenaltyAmount: 25 },
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

      prismaMock.cohortSession.findUnique.mockResolvedValue({
        ...mockSessionBase,
        cohort: { latePenaltyAmount: 25 },
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

      prismaMock.cohortSession.findUnique.mockResolvedValue({
        ...mockSessionBase,
        cohort: { latePenaltyAmount: 0 },
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
});
