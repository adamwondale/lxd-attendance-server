import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async updateProfile(userId: string, name?: string, username?: string) {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (username !== undefined) data.username = username;

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async listStudents(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenants: {
          some: {
            tenantId,
            role: 'STUDENT',
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminUpdateStudent(id: string, name?: string, email?: string) {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async adminDeleteStudent(id: string) {
    // Soft-delete or hard-delete. For demo, we just remove the UserTenantRole so they don't show up in the tenant.
    await this.prisma.userTenantRole.deleteMany({
      where: { userId: id, role: 'STUDENT' },
    });

    // Optionally we could delete the user if they have no other roles, but keeping it safe for the demo.
    return true;
  }
}
