import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeIntegration = testDatabaseUrl ? describe : describe.skip;

describeIntegration('PrismaService DB-02 (Mongo integration)', () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: testDatabaseUrl! } },
  });

  beforeAll(() => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    execFileSync(
      command,
      ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: testDatabaseUrl },
        stdio: 'inherit',
      },
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists cohort-session relations and enforces attendance-log uniqueness', async () => {
    await prisma.penalty.deleteMany();
    await prisma.attendanceLog.deleteMany();
    await prisma.cohortSession.deleteMany();
    await prisma.cohortMembership.deleteMany();
    await prisma.cohort.deleteMany();
    await prisma.userTenantRole.deleteMany();
    await prisma.tenant.deleteMany();
    await prisma.user.deleteMany();

    const tenant = await prisma.tenant.create({
      data: { name: 'DB-02 Test', slug: `db-02-${Date.now()}` },
    });
    const user = await prisma.user.create({
      data: { email: `db02-${Date.now()}@example.com`, name: 'DB-02 Student' },
    });
    const cohort = await prisma.cohort.create({
      data: {
        tenantId: tenant.id,
        name: 'DB-02 Cohort',
        pin: `db02-${Date.now()}`,
        startDate: new Date('2026-08-01T00:00:00Z'),
        endDate: new Date('2026-11-01T00:00:00Z'),
        durationMonths: 3,
      },
    });
    const session = await prisma.cohortSession.create({
      data: {
        cohortId: cohort.id,
        name: 'Morning',
        startTime: '09:00',
        gracePeriodMinutes: 5,
        recurrenceDays: ['EVERYDAY'],
      },
    });

    const persisted = await prisma.cohortSession.findUnique({
      where: { id: session.id },
      include: { cohort: true },
    });
    expect(persisted?.cohort.id).toBe(cohort.id);
    expect(persisted?.cohort.tenantId).toBe(tenant.id);

    await prisma.attendanceLog.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        date: '2026-08-30',
      },
    });

    await expect(
      prisma.attendanceLog.create({
        data: {
          sessionId: session.id,
          userId: user.id,
          date: '2026-08-30',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
