"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
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
//# sourceMappingURL=seed.js.map