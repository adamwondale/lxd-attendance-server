import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceResolver } from './attendance.resolver';
import { AttendanceService } from './attendance.service';
import { PubSub } from 'graphql-subscriptions';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('AttendanceResolver (WebSockets)', () => {
  let resolver: AttendanceResolver;
  let attendanceServiceMock: jest.Mocked<AttendanceService>;
  let pubSubMock: jest.Mocked<PubSub>;

  beforeEach(async () => {
    attendanceServiceMock = {
      logAttendance: jest.fn(),
      logAttendanceById: jest.fn(),
      adminLogAttendance: jest.fn(),
      adminScanStudentBadge: jest.fn(),
      waivePenalty: jest.fn(),
      assertSessionAccess: jest.fn(),
    } as unknown as jest.Mocked<AttendanceService>;

    pubSubMock = {
      publish: jest.fn(),
      asyncIterableIterator: jest.fn(),
    } as unknown as jest.Mocked<PubSub>;

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceResolver,
        { provide: AttendanceService, useValue: attendanceServiceMock },
        { provide: 'PUB_SUB', useValue: pubSubMock },
      ],
    }).compile();

    resolver = testingModule.get<AttendanceResolver>(AttendanceResolver);
  });

  const mockLog = {
    id: 'log-1',
    sessionId: 'session-123',
    date: '2026-08-30',
    scannedAt: new Date(),
    user: { id: 'student-1', name: 'Student', email: 'student@example.com' },
    isLate: false,
    latenessMinutes: 0,
    calculatedPenalty: 0,
  };

  it('WS-01: logAttendance publishes the current AttendanceEvent shape', async () => {
    attendanceServiceMock.logAttendance.mockResolvedValue(mockLog as never);

    const result = await resolver.logAttendance(
      { userId: 'student-1', tenantId: 'tenant-1' },
      'cohort-1.timestamp.signature',
    );

    expect(attendanceServiceMock.logAttendance).toHaveBeenCalledWith(
      'student-1',
      'cohort-1.timestamp.signature',
      undefined,
    );
    expect(pubSubMock.publish).toHaveBeenCalledWith(
      'attendanceLogged',
      expect.objectContaining({
        attendanceLogged: expect.objectContaining({
          id: 'log-1',
          cohortId: 'cohort-1',
          sessionId: 'session-123',
        }),
      }),
    );
    expect(result).toEqual(mockLog.id);
  });

  it('WS-02: admin mutations receive the authenticated tenant', async () => {
    attendanceServiceMock.waivePenalty.mockResolvedValue({ id: 'p1' } as never);
    attendanceServiceMock.adminLogAttendance.mockResolvedValue(mockLog as never);
    attendanceServiceMock.adminScanStudentBadge.mockResolvedValue(mockLog as never);

    await resolver.waivePenalty({ userId: 'admin-1', tenantId: 'tenant-1' }, 'p1');
    await resolver.adminLogAttendance({ userId: 'admin-1', tenantId: 'tenant-1' }, 'student-1', 'session-1');
    await resolver.adminScanStudentBadge({ userId: 'admin-1', tenantId: 'tenant-1' }, 'badge');

    expect(attendanceServiceMock.waivePenalty).toHaveBeenCalledWith('p1', 'tenant-1');
    expect(attendanceServiceMock.adminLogAttendance).toHaveBeenCalledWith('tenant-1', 'student-1', 'session-1');
    expect(attendanceServiceMock.adminScanStudentBadge).toHaveBeenCalledWith('tenant-1', 'badge');
  });

  it('WS-03: logAttendanceById ignores the caller-supplied traineeId', async () => {
    attendanceServiceMock.logAttendanceById.mockResolvedValue(mockLog as never);

    await resolver.logAttendanceById(
      { userId: 'authenticated-student', tenantId: 'tenant-1' },
      'attacker-selected-id',
      'cohort-1.timestamp.signature',
    );

    expect(attendanceServiceMock.logAttendanceById).toHaveBeenCalledWith(
      'authenticated-student',
      'cohort-1.timestamp.signature',
      undefined,
    );
    expect(Reflect.getMetadata(
      GUARDS_METADATA,
      AttendanceResolver.prototype.logAttendanceById,
    )).toContain(GqlAuthGuard);
  });

  it('WS-04: attendanceLogged verifies session access before subscribing', async () => {
    const iterator = {};
    attendanceServiceMock.assertSessionAccess.mockResolvedValue(true);
    pubSubMock.asyncIterableIterator.mockReturnValue(iterator as never);

    const result = await resolver.attendanceLogged(
      { userId: 'student-1', tenantId: 'tenant-1', role: 'STUDENT' },
      'session-123',
    );

    expect(attendanceServiceMock.assertSessionAccess).toHaveBeenCalledWith(
      'student-1',
      'tenant-1',
      'STUDENT',
      'session-123',
    );
    expect(result).toBe(iterator);
  });
});
