import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { User } from './dto/user.type';

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private readonly usersService: UsersService,
    @Inject('PUB_SUB') private pubSub: PubSub
  ) {}

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: any) {
    return this.usersService.me(user.userId);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  updateProfile(
    @CurrentUser() user: any,
    @Args('name', { nullable: true }) name?: string,
    @Args('username', { nullable: true }) username?: string,
  ) {
    return this.usersService.updateProfile(user.userId, name, username);
  }

  @Query(() => [User])
  @UseGuards(GqlAuthGuard, RolesGuard)
  listStudents(@CurrentUser() user: any) {
    return this.usersService.listStudents(user.tenantId);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async adminUpdateStudent(
    @Args('id') id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('email', { nullable: true }) email?: string,
  ) {
    const updated = await this.usersService.adminUpdateStudent(id, name, email);
    this.pubSub.publish('studentsUpdated', { onStudentsUpdated: true });
    return updated;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, RolesGuard)
  async adminDeleteStudent(@Args('id') id: string) {
    const deleted = await this.usersService.adminDeleteStudent(id);
    if (deleted) {
      this.pubSub.publish('studentsUpdated', { onStudentsUpdated: true });
    }
    return deleted;
  }

  @Subscription(() => Boolean)
  onStudentsUpdated() {
    return this.pubSub.asyncIterableIterator('studentsUpdated');
  }
}
