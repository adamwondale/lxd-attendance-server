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
    const cohortId = parts[0];

    // Verify cryptographic window (15-seconds sliding window)
    this.qrService.verifyQr(qrCode, cohortId);

    // Find student's session via membership
    const membership = await this.prisma.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId } }
    });

    if (!membership || !membership.sessionId) {
      throw new BadRequestException('You are not enrolled in any session for this cohort');
    }

    return this.processAttendance(userId, membership.sessionId);
  }

  async adminLogAttendance(studentId: string, sessionId: string) {
    return this.processAttendance(studentId, sessionId);
  }

  async adminScanStudentBadge(badgeCode: string, sessionId: string) {
    const studentId = this.qrService.verifyStudentQr(badgeCode);
    return this.processAttendance(studentId, sessionId);
  }

  private async processAttendance(userId: string, sessionId: string) {
    const session = await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: { cohort: true },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const now = new Date();
    // Create Date string e.g. "2026-08-29"
    const dateStr = now.toISOString().split('T')[0];

    // We can also check if the session runs today using recurrenceDays
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDay = dayNames[now.getDay()];
    
    if (session.recurrenceDays.length > 0 && !session.recurrenceDays.includes("EVERYDAY") && !session.recurrenceDays.includes(currentDay)) {
      throw new BadRequestException(`This session does not run on ${currentDay}`);
    }

    const [hours, minutes] = session.startTime.split(':').map(Number);
    
    const sessionTimeUtc = new Date(now);
    sessionTimeUtc.setUTCHours(hours - 3, minutes + session.gracePeriodMinutes, 0, 0);

    const isLate = now.getTime() > sessionTimeUtc.getTime();

    try {
      const log = await this.prisma.attendanceLog.create({
        data: {
          sessionId,
          userId,
          date: dateStr,
          isLate,
        },
      });

      if (isLate && session.latePenaltyAmount > 0) {
        await this.prisma.penalty.create({
          data: {
            attendanceLogId: log.id,
            userId,
            amount: session.latePenaltyAmount,
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
          where: { sessionId_userId_date: { sessionId, userId, date: dateStr } },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async getAttendanceLogs(cohortId?: string, sessionId?: string) {
    const where: Prisma.AttendanceLogWhereInput = {};
    
    if (sessionId) {
      where.sessionId = sessionId;
    } else if (cohortId) {
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
