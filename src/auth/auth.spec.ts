import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AuthModule } from './auth.module';
import { UsersResolver } from '../users/users.resolver';
import { JwtService } from '@nestjs/jwt';

describe('AUTH-01: JwtAuthGuard', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
        AuthModule,
      ],
      providers: [UsersResolver],
    }).compile();

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
      .send({ query: '{ me }' })
      .expect(200) // GraphQL usually returns 200 even for unauthorized
      .then((response) => {
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].message).toContain('Unauthorized');
      });
  });

  it('should return success when a mock JWT is provided', () => {
    const mockToken = jwtService.sign({ sub: '123' });
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Authorization', `Bearer ${mockToken}`)
      .send({ query: '{ me }' })
      .expect(200)
      .then((response) => {
        expect(response.body.data.me).toBe('authenticated_user');
      });
  });
});
