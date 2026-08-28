import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

jest.mock('@nestjs/graphql', () => {
  return {
    GqlExecutionContext: {
      create: jest.fn(),
    },
  };
});

describe('RolesGuard (ATTEND-03)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (userRole: string) => {
    const mockContext = {
      getContext: () => ({ req: { user: { role: userRole } } }),
    };
    (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockContext);
    return {
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('ATTEND-03: Student attempting to use Admin-assisted scan payload throws Forbidden (false)', () => {
    const ctx = createMockContext('STUDENT');
    
    // Simulate @Roles('COORDINATOR', 'SUPER_ADMIN')
    (reflector.get as jest.Mock).mockReturnValue(['COORDINATOR', 'SUPER_ADMIN']);

    const result = guard.canActivate(ctx);
    expect(result).toBe(false);
  });

  it('allows access for COORDINATOR', () => {
    const ctx = createMockContext('COORDINATOR');
    (reflector.get as jest.Mock).mockReturnValue(['COORDINATOR', 'SUPER_ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
