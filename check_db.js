const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cohorts = await prisma.cohort.findMany({ include: { sessions: true } });
  console.log(JSON.stringify(cohorts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
