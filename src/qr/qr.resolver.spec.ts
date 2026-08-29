import { Test, TestingModule } from '@nestjs/testing';
import { QrResolver } from './qr.resolver';
import { QrService } from './qr.service';

describe('QrResolver', () => {
  let resolver: QrResolver;
  let qrServiceMock: jest.Mocked<QrService>;

  beforeEach(async () => {
    qrServiceMock = {
      generateStudentQr: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrResolver,
        { provide: QrService, useValue: qrServiceMock },
      ],
    }).compile();

    resolver = module.get<QrResolver>(QrResolver);
  });

  it('QR-STATIC-03: myQrBadge generates code for current user', () => {
    qrServiceMock.generateStudentQr.mockReturnValue('student-1.signature');
    const user = { userId: 'student-1', role: 'STUDENT' };
    const result = resolver.myQrBadge(user);
    expect(qrServiceMock.generateStudentQr).toHaveBeenCalledWith('student-1');
    expect(result).toBe('student-1.signature');
  });

  it('QR-STATIC-04: studentQrBadge generates code for specified student', () => {
    qrServiceMock.generateStudentQr.mockReturnValue('student-2.signature');
    const result = resolver.studentQrBadge('student-2');
    expect(qrServiceMock.generateStudentQr).toHaveBeenCalledWith('student-2');
    expect(result).toBe('student-2.signature');
  });
});
