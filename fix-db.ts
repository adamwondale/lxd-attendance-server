import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Running MongoDB migration to backfill missing cohort endDate values...');

  const result = await prisma.$runCommandRaw({
    update: 'Cohort',
    updates: [
      {
        q: { $or: [{ endDate: { $exists: false } }, { endDate: null }] },
        u: [
          {
            $set: {
              durationMonths: {
                $cond: [
                  { $in: ['$durationMonths', [3, 6]] },
                  '$durationMonths',
                  3
                ]
              }
            }
          },
          {
            $set: {
              endDate: {
                $dateAdd: {
                  startDate: '$startDate',
                  unit: 'month',
                  amount: '$durationMonths'
                }
              }
            }
          }
        ],
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
