import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

describe('AuthResolver (Admin Registration)', () => {
  let resolver: AuthResolver;
  let authServiceMock: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authServiceMock = {
      registerAdmin: jest.fn(),
    } as any;

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    resolver = testingModule.get<AuthResolver>(AuthResolver);
  });

  it('AUTH-01: registerAdmin creates new super admin and tenant', async () => {
    authServiceMock.registerAdmin.mockResolvedValue({ id: 'user-1' } as any);
    
    const result = await resolver.registerAdmin(
      'admin@example.com',
      'password123',
      'Super Admin',
      'Hulu Track Academy'
    );
    
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      'admin@example.com',
      'password123',
      'Super Admin',
      'Hulu Track Academy',
      undefined,
      undefined,
      undefined
    );
    expect(result).toBe('user-1');
  });
});
