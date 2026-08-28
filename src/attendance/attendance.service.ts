import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qrService: QrService
  ) {}

  async logAttendance(userId: string, qrCode: string) {
    const parts = qrCode.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid QR code format');
    }
    const sessionId = parts[0];

    // Verify cryptographic window (15-seconds sliding window)
    this.qrService.verifyQr(qrCode, sessionId);

    return this.processAttendance(userId, sessionId);
  }

  async adminLogAttendance(studentId: string, sessionId: string) {
    return this.processAttendance(studentId, sessionId);
  }

  async adminScanStudentBadge(badgeCode: string, sessionId: string) {
    const studentId = this.qrService.verifyStudentQr(badgeCode);
    return this.processAttendance(studentId, sessionId);
  }

  private async processAttendance(userId: string, sessionId: string) {
    let session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: { cohort: true },
    });

    // DEMO FALLBACK: If a cohortId is passed as sessionId, mock a session
    if (!session) {
      const cohort = await this.prisma.cohort.findUnique({ where: { id: sessionId } });
      if (cohort) {
        session = {
          id: sessionId,
          cohortId: cohort.id,
          name: "Live Session",
          startTime: "00:00",
          gracePeriodMinutes: 1440, // 24 hours so they are never late in demo
          cohort: cohort
        } as any;
      } else {
        throw new BadRequestException('Session/Cohort not found');
      }
    }

    const now = new Date();
    const [hours, minutes] = session!.startTime.split(':').map(Number);
    
    const sessionTimeUtc = new Date(now);
    sessionTimeUtc.setUTCHours(hours - 3, minutes + session!.gracePeriodMinutes, 0, 0);

    const isLate = now.getTime() > sessionTimeUtc.getTime();

    try {
      const log = await this.prisma.attendanceLog.create({
        data: {
          sessionId,
          userId,
          isLate,
        },
      });

      if (isLate && session!.cohort.latePenaltyAmount > 0) {
        await this.prisma.penalty.create({
          data: {
            attendanceLogId: log.id,
            userId,
            amount: session!.cohort.latePenaltyAmount,
          },
        });
      }

      return log;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.attendanceLog.findUnique({
          where: { sessionId_userId: { sessionId, userId } },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async getAttendanceLogs(cohortId?: string) {
    const where: Prisma.AttendanceLogWhereInput = {};
    
    if (cohortId) {
      where.session = {
        cohortId
      };
    }

    return this.prisma.attendanceLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        penalty: true,
      },
      orderBy: {
        scannedAt: 'desc'
      },
      take: 200 // reasonable limit for demo
    });
  }

  async waivePenalty(penaltyId: string) {
    return this.prisma.penalty.update({
      where: { id: penaltyId },
      data: { status: 'WAIVED' }
    });
  }
}
