import { Test, TestingModule } from '@nestjs/testing';
import { CohortResolver } from './cohort.resolver';
import { CohortService } from './cohort.service';

describe('CohortResolver (Cohort Creation)', () => {
  let resolver: CohortResolver;
  let cohortServiceMock: jest.Mocked<CohortService>;

  beforeEach(async () => {
    cohortServiceMock = {
      createCohort: jest.fn(),
      createCohortSession: jest.fn(),
      updateCohortSession: jest.fn(),
       updateCohort: jest.fn(),
       deleteCohort: jest.fn(),
      deleteCohortSession: jest.fn(),
    } as any;

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        CohortResolver,
        { provide: CohortService, useValue: cohortServiceMock },
        { provide: 'PUB_SUB', useValue: { publish: jest.fn(), asyncIterableIterator: jest.fn() } }
      ],
    }).compile();

    resolver = testingModule.get<CohortResolver>(CohortResolver);
  });

  it('COHORT-01: createCohort delegates to CohortService', async () => {
    cohortServiceMock.createCohort.mockResolvedValue({ id: 'cohort-1' } as any);
    
    // user comes from CurrentUser decorator
    const user = { userId: 'admin-1', tenantId: 'tenant-1', role: 'SUPER_ADMIN' };

    const startDate = new Date('2026-08-01T00:00:00Z');
    const endDate = new Date('2026-11-01T00:00:00Z');

    const result = await resolver.createCohort(user, 'Math 101', '1234', startDate.toISOString(), endDate.toISOString());
    
    expect(cohortServiceMock.createCohort).toHaveBeenCalledWith(
      'tenant-1',
      'Math 101',
      '1234',
      startDate,
      endDate,
      undefined
    );
  });

  it('COHORT-01: createCohortSession delegates to CohortService', async () => {
    cohortServiceMock.createCohortSession.mockResolvedValue({ id: 's1' } as any);
    
    const result = await resolver.createCohortSession({ userId: 'admin-1', tenantId: 'tenant-1' }, 'c1', 'Morning', '09:00', 15, ['EVERYDAY'], 50);
    
    expect(cohortServiceMock.createCohortSession).toHaveBeenCalledWith('tenant-1', 'c1', 'Morning', '09:00', 15, ['EVERYDAY'], 50, undefined, undefined, undefined);
    expect(result).toEqual('s1');
  });

  it('COHORT-00: createCohort delegates to CohortService', async () => {
    cohortServiceMock.createCohort.mockResolvedValue({ id: 'c1' } as any);
    
    const startDate = new Date('2026-08-01T00:00:00Z');
    const endDate = new Date('2026-11-01T00:00:00Z');

    const result = await resolver.createCohort({ userId: 'u1', tenantId: 't1' }, 'Test Cohort', '1234', startDate.toISOString(), endDate.toISOString());
    
    expect(cohortServiceMock.createCohort).toHaveBeenCalledWith('t1', 'Test Cohort', '1234', startDate, endDate, undefined);
    expect(result).toEqual('c1');
  });

  it('COHORT-02: updateCohortSession delegates to CohortService', async () => {
    cohortServiceMock.updateCohortSession.mockResolvedValue({ id: 's1' } as any);
    
    const result = await resolver.updateCohortSession({ userId: 'admin-1', tenantId: 'tenant-1' }, 's1', 'New Name', undefined, 20, undefined, 75);
    
    expect(cohortServiceMock.updateCohortSession).toHaveBeenCalledWith(
      'tenant-1',
      's1',
      'New Name',
      undefined,
      20,
      undefined,
      75,
      undefined,
      undefined,
      undefined
    );
    expect(result).toEqual('s1');
  });

  it('COHORT-03: deleteCohortSession delegates to CohortService', async () => {
    cohortServiceMock.deleteCohortSession.mockResolvedValue(true);
    
    const result = await resolver.deleteCohortSession({ userId: 'admin-1', tenantId: 'tenant-1' }, 's1');
    
    expect(cohortServiceMock.deleteCohortSession).toHaveBeenCalledWith('tenant-1', 's1');
    expect(result).toEqual(true);
  });

  it('COHORT-UPDATE: updateCohort delegates tenant context', async () => {
    cohortServiceMock.updateCohort.mockResolvedValue({ id: 'c1' } as any);

    const startDate = new Date('2026-08-01T00:00:00Z');
    const endDate = new Date('2026-11-01T00:00:00Z');
    const result = await resolver.updateCohort(
      { userId: 'admin-1', tenantId: 'tenant-1' },
      'c1',
      'Updated',
      undefined,
      startDate.toISOString(),
      endDate.toISOString(),
      true,
      undefined,
    );

    expect(cohortServiceMock.updateCohort).toHaveBeenCalledWith(
      'tenant-1',
      'c1',
      'Updated',
      undefined,
      startDate,
      endDate,
      true,
      undefined,
    );
    expect(result).toBe('c1');
  });

  it('COHORT-DELETE: deleteCohort delegates tenant context', async () => {
    cohortServiceMock.deleteCohort.mockResolvedValue(true);
    const result = await resolver.deleteCohort({ userId: 'admin-1', tenantId: 'tenant-1' }, 'c1');
    expect(cohortServiceMock.deleteCohort).toHaveBeenCalledWith('tenant-1', 'c1');
    expect(result).toBe(true);
  });

  it('COHORT-04: joinedSession delegates to CohortService', async () => {
    cohortServiceMock.getJoinedSession = jest.fn().mockResolvedValue({ id: 's1', name: 'Morning' } as any);
    
    const user = { userId: 'student-1' };
    const cohort = { id: 'c1' } as any;

    const result = await resolver.joinedSession(cohort, user);
    
    expect(cohortServiceMock.getJoinedSession).toHaveBeenCalledWith('student-1', 'c1');
    expect(result).toEqual({ id: 's1', name: 'Morning' });
  });

  it('COHORT-05: joinedSession returns null if no user', async () => {
    const cohort = { id: 'c1' } as any;

    const result = await resolver.joinedSession(cohort, null);
    
    expect(result).toBeNull();
  });

  it('COHORT-06: joinCohort delegates to CohortService', async () => {
    cohortServiceMock.joinCohort = jest.fn().mockResolvedValue(true);
    
    const user = { userId: 'student-1' };
    
    const result = await resolver.joinCohort(user, 'c1', 's1', '1234');
    
    expect(cohortServiceMock.joinCohort).toHaveBeenCalledWith('student-1', 'c1', 's1', '1234');
    expect(result).toEqual(true);
  });
});
