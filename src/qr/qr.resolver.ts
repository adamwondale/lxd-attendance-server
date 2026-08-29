import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { QrService } from './qr.service';
import { GqlAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver()
export class QrResolver {
  constructor(private readonly qrService: QrService) {}

  @Query(() => String)
  @UseGuards(GqlAuthGuard)
  myQrBadge(@CurrentUser() user: any) {
    return this.qrService.generateStudentQr(user.userId);
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  studentQrBadge(@Args('studentId') studentId: string) {
    return this.qrService.generateStudentQr(studentId);
  }

  @Query(() => String)
  @UseGuards(GqlAuthGuard, RolesGuard)
  generateCohortQr(@Args('cohortId') cohortId: string) {
    return this.qrService.generateQr(cohortId);
  }
}
