import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.penalty.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.cohortSession.deleteMany();
  await prisma.cohortMembership.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.userTenantRole.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding default Admin and Tenant...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const tenant = await prisma.tenant.create({
    data: {
      name: 'LXD Academy',
      slug: 'lxd-academy',
      timezone: 'Africa/Addis_Ababa'
    }
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@lxd.com',
      name: 'Default Admin',
      password: hashedPassword,
      tenants: {
        create: {
          tenantId: tenant.id,
          role: 'SUPER_ADMIN'
        }
      }
    }
  });

  console.log('----------------------------------------------------');
  console.log('✅ Seeding Complete!');
  console.log('Tenant:', tenant.name);
  console.log('Admin Email:', admin.email);
  console.log('Admin Password: admin123');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
