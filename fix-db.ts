import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running MongoDB migration to backfill endDate...');
  
  // Use raw MongoDB command to update documents that don't have endDate
  const result = await prisma.$runCommandRaw({
    update: 'Cohort',
    updates: [
      {
        q: { endDate: { $exists: false } },
        u: { $set: { endDate: { $date: new Date().toISOString() } } },
        multi: true
      }
    ]
  });

  console.log('Migration complete:', result);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
