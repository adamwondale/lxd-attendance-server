const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Repairing student tenant roles from cohort memberships...");

  const memberships = await prisma.cohortMembership.findMany({
    select: {
      userId: true,
      cohort: { select: { tenantId: true, name: true } },
    },
  });

  let created = 0;
  let existing = 0;

  for (const membership of memberships) {
    const role = await prisma.userTenantRole.findUnique({
      where: {
        userId_tenantId: {
          userId: membership.userId,
          tenantId: membership.cohort.tenantId,
        },
      },
    });

    if (role) {
      existing++;
      continue;
    }

    await prisma.userTenantRole.create({
      data: {
        userId: membership.userId,
        tenantId: membership.cohort.tenantId,
        role: "STUDENT",
      },
    });

    created++;
    console.log(`Created STUDENT tenant role for ${membership.userId} in ${membership.cohort.name}`);
  }

  console.log(`\nDone. Created: ${created}; already present: ${existing}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
