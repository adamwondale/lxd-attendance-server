import { Test, TestingModule } from '@nestjs/testing';
import { CohortResolver } from './cohort.resolver';
import { CohortService } from './cohort.service';

describe('CohortResolver (Cohort Creation)', () => {
  let resolver: CohortResolver;
  let cohortServiceMock: jest.Mocked<CohortService>;

  beforeEach(async () => {
    cohortServiceMock = {
      createCohort: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortResolver,
        { provide: CohortService, useValue: cohortServiceMock },
      ],
    }).compile();

    resolver = module.get<CohortResolver>(CohortResolver);
  });

  it('COHORT-01: createCohort delegates to CohortService', async () => {
    cohortServiceMock.createCohort.mockResolvedValue({ id: 'cohort-1' } as any);
    
    // user comes from CurrentUser decorator
    const user = { id: 'admin-1', tenants: [{ tenantId: 'tenant-1', role: 'SUPER_ADMIN' }] };

    const result = await resolver.createCohort(user, 'Math 101', '1234', 6, 25);
    
    expect(cohortServiceMock.createCohort).toHaveBeenCalledWith(
      'tenant-1',
      'Math 101',
      '1234',
      6,
      25
    );
    expect(result).toEqual('cohort-1');
  });
});
