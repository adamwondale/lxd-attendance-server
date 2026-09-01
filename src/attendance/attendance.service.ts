import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { Prisma } from '@prisma/client';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const LOCKOUT_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly qrService: QrService) {}

  private normalizeDays(days: string[] = []) {
    return days.map((day) => {
      const value = day.toUpperCase();
      return value === 'EVERYDAY' ? 'EVERYDAY' : value.slice(0, 3);
    });
  }

  private dateInTimezone(date: Date, timezone = 'Africa/Addis_Ababa') {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  private getLocalClock(now: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value || 0);
    return { hour: get('hour'), minute: get('minute') };
  }

  private getCurrentDay(now: Date, timezone: string) {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(now).toUpperCase();
    return weekday.slice(0, 3);
  }

  private getExpectedMinutes(startTime: string, graceMinutes: number) {
    const [hours, minutes] = startTime.split(':').map(Number);
    return hours * 60 + minutes + graceMinutes;
  }

  private calculatePenalty(latenessMinutes: number, session: any) {
    if (latenessMinutes <= 0) return 0;
    const base = session.latePenaltyAmount ?? 25;
    const threshold = session.escalationThresholdMinutes ?? 15;
    const rate = session.escalationRate ?? 5;
    const interval = Math.max(1, session.escalationIntervalMinutes ?? 5);
    if (latenessMinutes <= threshold) return base;
    return base + Math.floor((latenessMinutes - threshold) / interval) * rate;
  }

  private async assertDeviceAvailable(deviceSignature?: string) {
    if (!deviceSignature) return;
    const lock = await this.prisma.deviceLock.findUnique({ where: { signature: deviceSignature } });
    if (lock && lock.lockedUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((lock.lockedUntil.getTime() - Date.now()) / 60000));
      throw new ForbiddenException(`Device locked. Try again in about ${remainingMinutes} minutes.`);
    }
  }

  private async lockDevice(deviceSignature?: string) {
    if (!deviceSignature) return;
    const now = new Date();
    const lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    const released = await this.prisma.deviceLock.updateMany({
      where: { signature: deviceSignature, lockedUntil: { lte: now } },
      data: { lockedUntil },
    });
    if (released.count) return;
    try {
      await this.prisma.deviceLock.create({ data: { signature: deviceSignature, lockedUntil } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ForbiddenException('Device was used by another check-in. Please wait 3 hours before scanning again.');
      }
      throw error;
    }
  }

  async logAttendance(userId: string, qrCode: string, deviceSignature?: string) {
    const parts = qrCode.split('.');
    if (parts.length !== 3 && parts.length !== 4) throw new BadRequestException('Invalid QR code format');
    const cohortId = parts[0];
    const sessionId = parts.length === 4 ? parts[1] : undefined;
    this.qrService.verifyQr(qrCode, cohortId, sessionId);

    const membership = sessionId
      ? await this.prisma.cohortMembership.findFirst({
          where: { cohortId, userId, sessionId, status: 'ACTIVE' },
          include: { session: { include: { cohort: { include: { tenant: true } } } } },
        })
      : await this.prisma.cohortMembership.findUnique({
          where: { cohortId_userId: { cohortId, userId } },
          include: { session: { include: { cohort: { include: { tenant: true } } } } }
        });
    if (!membership || !membership.session) {
      throw new BadRequestException(
        sessionId
          ? 'You are not enrolled in this session for this cohort'
          : 'You are not enrolled in any session for this cohort',
      );
    }

    await this.assertDeviceAvailable(deviceSignature);
    return this.processAttendance(userId, membership.sessionId!, membership.session, deviceSignature, false);
  }

  async logAttendanceById(traineeId: string, qrCode: string, deviceSignature?: string) {
    const parts = qrCode.split('.');
    if (parts.length !== 3 && parts.length !== 4) throw new BadRequestException('Invalid QR code format');
    const cohortId = parts[0];
    const sessionId = parts.length === 4 ? parts[1] : undefined;
    this.qrService.verifyQr(qrCode, cohortId, sessionId);
    const user = await this.prisma.user.findUnique({ where: { id: traineeId } });
    if (!user) throw new BadRequestException('Invalid trainee identifier provided.');
    const membership = sessionId
      ? await this.prisma.cohortMembership.findFirst({
          where: { cohortId, userId: traineeId, sessionId, status: 'ACTIVE' },
          include: { session: { include: { cohort: { include: { tenant: true } } } } },
        })
      : await this.prisma.cohortMembership.findUnique({
          where: { cohortId_userId: { cohortId, userId: traineeId } },
          include: { session: { include: { cohort: { include: { tenant: true } } } } }
        });
    if (!membership?.session) throw new BadRequestException('Trainee is not enrolled in this cohort.');
    await this.assertDeviceAvailable(deviceSignature);
    return this.processAttendance(traineeId, membership.sessionId!, membership.session, deviceSignature, false);
  }

  async assertSessionAccess(userId: string, tenantId: string, role: string | undefined, sessionId: string) {
    const session = await this.prisma.cohortSession.findFirst({
      where: {
        id: sessionId,
        cohort: { tenantId },
      },
      select: { id: true },
    });
    if (!session) throw new ForbiddenException('Session is not accessible for this tenant.');

    if (role === 'STUDENT') {
      const membership = await this.prisma.cohortMembership.findFirst({
        where: { userId, sessionId, status: 'ACTIVE', cohort: { tenantId } },
        select: { id: true },
      });
      if (!membership) throw new ForbiddenException('You are not enrolled in this session.');
      return true;
    }

    if (!['COORDINATOR', 'SUPER_ADMIN', 'ADMIN'].includes(role || '')) {
      throw new ForbiddenException('You are not authorized for this session.');
    }
    return true;
  }

  async adminLogAttendance(tenantId: string, studentId: string, sessionId: string) {
    await this.assertSessionAccess(studentId, tenantId, 'STUDENT', sessionId);
    return this.processAttendance(studentId, sessionId, undefined, undefined, true);
  }

  async adminScanStudentBadge(tenantId: string, badgeCode: string) {
    const studentId = this.qrService.verifyStudentQr(badgeCode);
    const memberships = await this.prisma.cohortMembership.findMany({
      where: { userId: studentId, status: 'ACTIVE', cohort: { tenantId, isActive: true } },
      include: { session: { include: { cohort: { include: { tenant: true } } } } }
    });
    if (!memberships.length) throw new BadRequestException('Student is not enrolled in any active cohorts.');

    const now = new Date();
    const currentDayByTimezone = (timezone: string) => this.getCurrentDay(now, timezone);
    const active = memberships.find(m => {
      const session = m.session;
      if (!session) return false;
      const timezone = session.cohort?.tenant?.timezone || 'Africa/Addis_Ababa';
      const currentDay = currentDayByTimezone(timezone);
      const days = this.normalizeDays(session.recurrenceDays);
      return !days.length || days.includes('EVERYDAY') || days.includes('ALL') || days.includes(currentDay);
    });
    const selected = active || memberships[0];
    if (!selected.session) throw new BadRequestException('Student membership has no assigned session.');
    return this.processAttendance(studentId, selected.sessionId!, selected.session, undefined, true);
  }

  private async processAttendance(userId: string, sessionId: string, preloadedSession?: any, deviceSignature?: string, isManualScan = false) {
    const now = new Date();
    const timezone = preloadedSession?.cohort?.tenant?.timezone || 'Africa/Addis_Ababa';
    const dateStr = this.dateInTimezone(now, timezone);

    const existingLog = await this.prisma.attendanceLog.findUnique({
      where: { sessionId_userId_date: { sessionId, userId, date: dateStr } },
      include: { user: { select: { id: true, name: true, email: true } }, penalty: true }
    });
    if (existingLog) return existingLog;

    const session = preloadedSession || await this.prisma.cohortSession.findUnique({
      where: { id: sessionId },
      include: { cohort: { include: { tenant: true } } },
    });
    if (!session) throw new BadRequestException('Session not found');

    const currentDay = this.getCurrentDay(now, timezone);
    const days = this.normalizeDays(session.recurrenceDays);
    if (days.length && !days.includes('EVERYDAY') && !days.includes('ALL') && !days.includes(currentDay)) {
      throw new BadRequestException(`This session does not run on ${currentDay}`);
    }

    const localClock = this.getLocalClock(now, timezone);
    const startMinutes = this.getExpectedMinutes(session.startTime, 0);
    const expectedMinutes = this.getExpectedMinutes(session.startTime, session.gracePeriodMinutes);
    let currentMinutes = localClock.hour * 60 + localClock.minute;
    if (expectedMinutes >= 24 * 60 && currentMinutes < startMinutes) currentMinutes += 24 * 60;
    const latenessMinutes = Math.max(0, currentMinutes - expectedMinutes);
    const isLate = latenessMinutes > 0;
    const calculatedPenalty = this.calculatePenalty(latenessMinutes, session);

    if (!isManualScan) await this.lockDevice(deviceSignature);

    let log;
    try {
      log = await this.prisma.attendanceLog.create({
        data: {
          sessionId, userId, date: dateStr, isLate, latenessMinutes,
          calculatedPenalty, deviceSignature: deviceSignature || null, isManualScan,
        },
        include: { user: { select: { id: true, name: true, email: true } }, penalty: true, session: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.attendanceLog.findUnique({
          where: { sessionId_userId_date: { sessionId, userId, date: dateStr } },
          include: { user: { select: { id: true, name: true, email: true } }, penalty: true, session: true },
        });
      }
      throw error;
    }

    if (calculatedPenalty > 0) {
      await this.prisma.penalty.create({
        data: { attendanceLogId: log.id, userId, amount: calculatedPenalty },
      });
    }

    return this.prisma.attendanceLog.findUnique({
      where: { id: log.id },
      include: { user: { select: { id: true, name: true, email: true } }, penalty: true, session: true },
    });
  }

  async getMyAttendanceSummary(userId: string) {
    const logs = await this.prisma.attendanceLog.findMany({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } }, penalty: true, session: true },
      orderBy: { scannedAt: 'desc' },
      take: 1000,
    });
    const lateLogs = logs.filter(log => log.isLate);
    return {
      presentDays: new Set(logs.map(log => log.date)).size,
      lateDays: new Set(lateLogs.map(log => log.date)).size,
      totalPenalty: logs.reduce((sum, log) => sum + (log.penalty?.amount || log.calculatedPenalty || 0), 0),
      lateLogs,
    };
  }

  async getAttendanceLogs(cohortId?: string, sessionId?: string, tenantId?: string) {
    const where: Prisma.AttendanceLogWhereInput = {};
    if (tenantId) where.session = { cohort: { tenantId } };
    if (sessionId) where.sessionId = sessionId;
    else if (cohortId) where.session = tenantId ? { cohortId, cohort: { tenantId } } : { cohortId };
    return this.prisma.attendanceLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } }, penalty: true, session: true },
      orderBy: { scannedAt: 'desc' }, take: 500,
    });
  }

  async getDailyRosterStats(tenantId: string) {
    const now = new Date();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const date = this.dateInTimezone(now, tenant?.timezone || 'Africa/Addis_Ababa');
    const memberships = await this.prisma.cohortMembership.findMany({
      where: { status: 'ACTIVE', cohort: { tenantId, isActive: true } },
      include: { user: { select: { id: true } }, session: true },
    });
    const logs = await this.prisma.attendanceLog.findMany({
      where: { date, session: { cohort: { tenantId, isActive: true } } },
      select: { userId: true, isLate: true },
    });
    const presentIds = new Set(logs.map(l => l.userId));
    return {
      presentToday: presentIds.size,
      lateToday: new Set(logs.filter(l => l.isLate).map(l => l.userId)).size,
      absentToday: new Set(memberships.map(m => m.user.id).filter(id => !presentIds.has(id))).size,
    };
  }

  async getAttendanceReport(tenantId: string, startDate: string, endDate: string, cohortId?: string, sessionId?: string) {
    const memberships = await this.prisma.cohortMembership.findMany({
      where: {
        status: 'ACTIVE',
        cohort: { tenantId, isActive: true, ...(cohortId ? { id: cohortId } : {}) },
        ...(sessionId ? { sessionId } : {}),
      },
      include: { user: true, session: { include: { cohort: true } } },
    });
    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        session: { cohort: { tenantId, ...(cohortId ? { id: cohortId } : {}) }, ...(sessionId ? { id: sessionId } : {}) },
      },
      include: { penalty: true },
    });
    const logMap = new Map(logs.map(l => [`${l.sessionId}|${l.userId}|${l.date}`, l]));
    const rows: any[] = [];
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const day = DAY_NAMES[cursor.getUTCDay()];
      for (const membership of memberships) {
        if (!membership.session) continue;
        const days = this.normalizeDays(membership.session.recurrenceDays);
        if (days.length && !days.includes('EVERYDAY') && !days.includes('ALL') && !days.includes(day)) continue;
        const log = logMap.get(`${membership.session.id}|${membership.userId}|${date}`);
        rows.push({
          id: log?.id || `absent-${membership.session.id}-${membership.userId}-${date}`,
          date,
          status: log ? (log.isLate ? 'Late' : 'Present') : 'Absent',
          traineeId: membership.userId,
          traineeName: membership.user.name,
          sessionName: membership.session.name,
          cohortName: membership.session.cohort.name,
          latenessMinutes: log?.latenessMinutes || 0,
          penalty: log?.penalty?.amount || log?.calculatedPenalty || 0,
        });
      }
    }
    return rows;
  }

  async waivePenalty(penaltyId: string, tenantId: string) {
    const penalty = await this.prisma.penalty.findFirst({
      where: { id: penaltyId, attendanceLog: { session: { cohort: { tenantId } } } },
      select: { id: true },
    });
    if (!penalty) throw new ForbiddenException('Penalty is not accessible for this tenant.');
    return this.prisma.penalty.update({ where: { id: penalty.id }, data: { status: 'WAIVED' } });
  }
}
