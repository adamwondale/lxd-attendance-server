import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AuthModule } from './auth.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

describe('AUTH-01: JwtAuthGuard', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  jest.setTimeout(30000); // Increase timeout globally for this test suite

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
        AuthModule,
        UsersModule,
      ],
      providers: [
        { provide: 'PUB_SUB', useValue: { publish: jest.fn(), asyncIterableIterator: jest.fn() } }
      ],
    })
    .overrideProvider(UsersService)
    .useValue({
      me: jest.fn().mockResolvedValue({ id: 'some-user-id' }),
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 Unauthorized when no Bearer token is provided', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ me { id } }' })
      .expect(200) // GraphQL usually returns 200 even for unauthorized
      .then((response) => {
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('Unauthorized');
      });
  });

  it('should return success when a mock JWT is provided', () => {
    // MongoDB ObjectID is a 24-character hex string
    const mockToken = jwtService.sign({ sub: '507f1f77bcf86cd799439011' });
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({ query: '{ me { id } }' })
      .expect(200)
      .then((response) => {
        expect(response.body.errors).toBeUndefined();
      });
  });
});
