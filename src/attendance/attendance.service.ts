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

    // 1. Fast HMAC Verification & 15-second Sliding Window
    // Throws exception immediately if tampered or expired
    this.qrService.verifyQr(qrCode, cohortId);

    // 2. Query Consolidation: fetch membership and session in one go
    const membership = await this.prisma.cohortMembership.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
      include: { session: { include: { cohort: true } } }
    });

    if (!membership || !membership.session) {
      throw new BadRequestException('You are not enrolled in any session for this cohort');
    }

    return this.processAttendance(userId, membership.sessionId, membership.session);
  }

  async adminLogAttendance(studentId: string, sessionId: string) {
    return this.processAttendance(studentId, sessionId);
  }

  async adminScanStudentBadge(badgeCode: string) {
    const studentId = this.qrService.verifyStudentQr(badgeCode);
    
    // Auto-detect the student's active session for today.
    const memberships = await this.prisma.cohortMembership.findMany({
      where: { userId: studentId, status: 'ACTIVE' },
      include: { session: { include: { cohort: true } } }
    });

    if (memberships.length === 0) {
      throw new BadRequestException('Student is not enrolled in any active cohorts.');
    }

    const now = new Date();
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDay = dayNames[now.getDay()];

    const activeMembershipToday = memberships.find(m => {
      const session = m.session;
      if (!session) return false;
      if (session.recurrenceDays.length === 0 || session.recurrenceDays.includes("EVERYDAY")) return true;
      return session.recurrenceDays.includes(currentDay);
    });

    if (!activeMembershipToday || !activeMembershipToday.session) {
      const fallback = memberships[0];
      if (!fallback.session) throw new BadRequestException('Student membership has no assigned session.');
      return this.processAttendance(studentId, fallback.sessionId, fallback.session);
    }

    return this.processAttendance(studentId, activeMembershipToday.sessionId, activeMembershipToday.session);
  }

  private async processAttendance(userId: string, sessionId: string, preloadedSession?: any) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // 3. The "Read-Before-Write" Pattern
    // Extremely fast lookup on compound unique index before trying to write.
    const existingLog = await this.prisma.attendanceLog.findUnique({
      where: { sessionId_userId_date: { sessionId, userId, date: dateStr } }
    });

    if (existingLog) return existingLog;

    const session = preloadedSession || await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: { cohort: true },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDay = dayNames[now.getDay()];
    
    if (session.recurrenceDays && session.recurrenceDays.length > 0 && !session.recurrenceDays.includes("EVERYDAY") && !session.recurrenceDays.includes(currentDay)) {
      throw new BadRequestException(`This session does not run on ${currentDay}`);
    }

    const [hours, minutes] = session.startTime.split(':').map(Number);
    const sessionTimeUtc = new Date(now);
    sessionTimeUtc.setUTCHours(hours - 3, minutes + session.gracePeriodMinutes, 0, 0);

    const isLate = now.getTime() > sessionTimeUtc.getTime();

    // The rare race condition (if they scan on two devices simultaneously) is caught by Prisma exception
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
      take: 200
    });
  }

  async waivePenalty(penaltyId: string) {
    return this.prisma.penalty.update({
      where: { id: penaltyId },
      data: { status: 'WAIVED' }
    });
  }
}
