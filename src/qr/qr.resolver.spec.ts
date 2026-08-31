import { Test, TestingModule } from '@nestjs/testing';
import { QrResolver } from './qr.resolver';
import { QrService } from './qr.service';
import { PrismaService } from '../prisma/prisma.service';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('QrResolver', () => {
  let resolver: QrResolver;
  let qrServiceMock: Pick<QrService, 'generateStudentQr' | 'generateQr'>;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    qrServiceMock = {
      generateStudentQr: jest.fn(),
      generateQr: jest.fn(),
    };
    prismaMock = mockDeep<PrismaService>();

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        QrResolver,
        { provide: QrService, useValue: qrServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    resolver = testingModule.get<QrResolver>(QrResolver);
  });

  it('QR-STATIC-03: myQrBadge generates code for current user', () => {
    qrServiceMock.generateStudentQr.mockReturnValue('student-1.signature');
    const user = { userId: 'student-1', role: 'STUDENT', tenantId: 'tenant-1' };
    const result = resolver.myQrBadge(user);
    expect(qrServiceMock.generateStudentQr).toHaveBeenCalledWith('student-1');
    expect(result).toBe('student-1.signature');
  });

  it('QR-STATIC-04: studentQrBadge requires student membership in the current tenant', async () => {
    prismaMock.userTenantRole.findFirst.mockResolvedValue({ userId: 'student-2' } as never);
    qrServiceMock.generateStudentQr.mockReturnValue('student-2.signature');

    const result = await resolver.studentQrBadge(
      { userId: 'admin-1', role: 'SUPER_ADMIN', tenantId: 'tenant-1' },
      'student-2',
    );

    expect(prismaMock.userTenantRole.findFirst).toHaveBeenCalledWith({
      where: { userId: 'student-2', tenantId: 'tenant-1', role: 'STUDENT' },
      select: { userId: true },
    });
    expect(qrServiceMock.generateStudentQr).toHaveBeenCalledWith('student-2');
    expect(result).toBe('student-2.signature');
  });

  it('QR-STATIC-05: generateCohortQr requires cohort membership in the current tenant', async () => {
    prismaMock.cohort.findFirst.mockResolvedValue({ id: 'cohort-1' } as never);
    qrServiceMock.generateQr.mockReturnValue('cohort-1.timestamp.signature');

    const result = await resolver.generateCohortQr(
      { userId: 'admin-1', role: 'SUPER_ADMIN', tenantId: 'tenant-1' },
      'cohort-1',
    );

    expect(prismaMock.cohort.findFirst).toHaveBeenCalledWith({
      where: { id: 'cohort-1', tenantId: 'tenant-1' },
      select: { id: true },
    });
    expect(qrServiceMock.generateQr).toHaveBeenCalledWith('cohort-1');
    expect(result).toBe('cohort-1.timestamp.signature');
  });
});
