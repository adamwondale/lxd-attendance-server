"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=fix-db.js.map
