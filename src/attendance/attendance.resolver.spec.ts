import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceResolver } from './attendance.resolver';
import { AttendanceService } from './attendance.service';
import { PubSub } from 'graphql-subscriptions';

describe('AttendanceResolver (WebSockets)', () => {
  let resolver: AttendanceResolver;
  let attendanceServiceMock: jest.Mocked<AttendanceService>;
  let pubSubMock: jest.Mocked<PubSub>;

  beforeEach(async () => {
    attendanceServiceMock = {
      logAttendance: jest.fn(),
      adminLogAttendance: jest.fn(),
    } as any;

    pubSubMock = {
      publish: jest.fn(),
      asyncIterator: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceResolver,
        { provide: AttendanceService, useValue: attendanceServiceMock },
        { provide: 'PUB_SUB', useValue: pubSubMock },
      ],
    }).compile();

    resolver = module.get<AttendanceResolver>(AttendanceResolver);
  });

  const mockLog = { id: 'log-1', sessionId: 'session-123' };

  it('WS-01: logAttendance publishes attendanceLogged event', async () => {
    attendanceServiceMock.logAttendance.mockResolvedValue(mockLog as any);
    
    // Simulating context user
    const result = await resolver.logAttendance({ id: 'student-1' }, 'dummy-qr-code');
    
    expect(attendanceServiceMock.logAttendance).toHaveBeenCalledWith('student-1', 'dummy-qr-code');
    expect(pubSubMock.publish).toHaveBeenCalledWith('attendanceLogged', { attendanceLogged: mockLog });
    expect(result).toEqual(mockLog);
  });
});
