const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.deviceLock.deleteMany({});
  console.log('Cleared DeviceLock');
}

main().catch(console.error).finally(() => prisma.$disconnect());
