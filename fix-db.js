"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Running MongoDB migration to backfill endDate...');
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
//# sourceMappingURL=fix-db.js.map