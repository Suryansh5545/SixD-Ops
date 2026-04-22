/**
 * Prisma Seed Script
 * Populates: roles, users (with hashed passwords/PINs), engineers, clients,
 * compliance doc types, equipment, and client compliance requirements.
 *
 * Run: npm run db:seed
 * Default password: SixD@2024
 * Default PIN (field engineers): 123456
 */

import { loadEnvConfig } from "@next/env";
import { PrismaClient, Role, Division, EngineerLevel, IndustrySector, PaymentTerms } from "@prisma/client";
import bcrypt from "bcryptjs";

// Standalone tsx/node execution does not get Next.js env loading for free.
loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "SixD@2024";
const DEFAULT_PIN = "123456";

async function main() {
  console.log("🌱 Starting seed...");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const pinHash = await bcrypt.hash(DEFAULT_PIN, 12);

  // ─── MANAGEMENT USERS ─────────────────────────────────────────────────────

  const pawan = await upsertUser({
    name: "Pawan",
    email: "pawan@sixdengineering.com",
    passwordHash,
    role: Role.MD,
    roles: [Role.MD],
  });

  const vinay = await upsertUser({
    name: "Vinay Mishra",
    email: "vinay.mishra@sixdengineering.com",
    passwordHash,
    role: Role.CFO,
    roles: [Role.CFO],
  });

  const vaibhav = await upsertUser({
    name: "Vaibhav Tyagi",
    email: "vaibhav.tyagi@sixdengineering.com",
    passwordHash,
    role: Role.BUSINESS_HEAD,
    roles: [Role.BUSINESS_HEAD],
  });

  const nidhi = await upsertUser({
    name: "Nidhi Bharti",
    email: "nidhi.bharti@sixdengineering.com",
    passwordHash,
    role: Role.BUSINESS_MANAGER,
    roles: [Role.BUSINESS_MANAGER],
  });

  // Syed Ali — dual role: primary PM + secondary BM_TATA_GOVT
  const syedAli = await upsertUser({
    name: "Syed Ali",
    email: "syed.ali@sixdengineering.com",
    passwordHash,
    role: Role.BUSINESS_MANAGER,
    roles: [Role.BUSINESS_MANAGER],
  });

  const gaurav = await upsertUser({
    name: "Gaurav",
    email: "gaurav@sixdengineering.com",
    passwordHash,
    role: Role.BUSINESS_MANAGER,
    roles: [Role.BUSINESS_MANAGER],
  });

  const suraj = await upsertUser({
    name: "Suraj Pandey",
    email: "suraj.pandey@sixdengineering.com",
    passwordHash,
    role: Role.SALES_TEAM,
    roles: [Role.SALES_TEAM],
  });

  const yash = await upsertUser({
    name: "Yash Patel",
    email: "yash.patel@sixdengineering.com",
    passwordHash,
    role: Role.BD_TEAM,
    roles: [Role.BD_TEAM],
  });

  const adminCoordinator = await upsertUser({
    name: "Operations Coordinator",
    email: "admin@sixdengineering.com",
    passwordHash,
    role: Role.BUSINESS_HEAD,
    roles: [Role.BUSINESS_HEAD],
  });

  const accounts = await upsertUser({
    name: "Accounts Team",
    email: "accounts@sixdengineering.com",
    passwordHash,
    role: Role.ACCOUNTS,
    roles: [Role.ACCOUNTS],
  });

  console.log("✅ Management users created");

  // ─── TS DIVISION ENGINEERS ─────────────────────────────────────────────────

  const digivijay = await upsertEngineerUser({
    name: "Digivijay",
    email: "digivijay@sixdengineering.com",
    passwordHash,
    pinHash,
    division: Division.TS,
    level: EngineerLevel.HEAD,
  });

  const santosh = await upsertEngineerUser({
    name: "Santosh",
    email: "santosh@sixdengineering.com",
    passwordHash,
    pinHash,
    division: Division.TS,
    level: EngineerLevel.LEADER,
  });

  const rama = await upsertEngineerUser({
    name: "Rama",
    email: "rama@sixdengineering.com",
    passwordHash,
    pinHash,
    division: Division.TS,
    level: EngineerLevel.LEADER,
  });

  // TS Field Engineers
  const tsFieldEngineers = [
    "Azhar", "Anil", "Durga", "Satya", "Sunil", "Mukesh", "Arun", "Ravi", "Biswajit Singh"
  ];

  for (const name of tsFieldEngineers) {
    await upsertEngineerUser({
      name,
      email: `${name.toLowerCase().replace(" ", ".")}@sixdengineering.com`,
      passwordHash,
      pinHash,
      division: Division.TS,
      level: EngineerLevel.FIELD,
    });
  }

  console.log("✅ TS Division engineers created");

  // ─── LS&S DIVISION ENGINEERS ──────────────────────────────────────────────

  const kaleem = await upsertEngineerUser({
    name: "Kaleem",
    email: "kaleem@sixdengineering.com",
    passwordHash,
    pinHash,
    division: Division.LSS,
    level: EngineerLevel.HEAD,
  });

  const lssLeaders = ["Shri Ram", "Yogesh", "Shubham"];
  for (const name of lssLeaders) {
    await upsertEngineerUser({
      name,
      email: `${name.toLowerCase().replace(" ", ".")}@sixdengineering.com`,
      passwordHash,
      pinHash,
      division: Division.LSS,
      level: EngineerLevel.LEADER,
    });
  }

  const lssFieldEngineers = ["Aditya", "Kamlesh", "Nariender", "Subhash"];
  for (const name of lssFieldEngineers) {
    await upsertEngineerUser({
      name,
      email: `${name.toLowerCase()}@sixdengineering.com`,
      passwordHash,
      pinHash,
      division: Division.LSS,
      level: EngineerLevel.FIELD,
    });
  }

  console.log("✅ LS&S Division engineers created");

  // ─── CLIENTS ──────────────────────────────────────────────────────────────

  const tataSteel = await prisma.client.upsert({
    where: { name: "Tata Steel" },
    update: {},
    create: {
      name: "Tata Steel",
      sector: IndustrySector.STEEL,
      paymentTermsDefault: PaymentTerms.NET_45,
      gstPercent: 18.0,
      portalType: "TATA Vendor Portal",
      gstNumber: "27AAACT2727Q1ZW",
      contactPerson: "Procurement Team",
    },
  });

  const sail = await prisma.client.upsert({
    where: { name: "SAIL" },
    update: {},
    create: {
      name: "SAIL",
      sector: IndustrySector.STEEL,
      paymentTermsDefault: PaymentTerms.NET_45,
      gstPercent: 18.0,
      portalType: "SAIL GeM Portal",
      gstNumber: "19AAACS7659Q1ZS",
      contactPerson: "Procurement Cell",
    },
  });

  const jsw = await prisma.client.upsert({
    where: { name: "JSW Steel" },
    update: {},
    create: {
      name: "JSW Steel",
      sector: IndustrySector.STEEL,
      paymentTermsDefault: PaymentTerms.NET_30,
      gstPercent: 18.0,
      portalType: "JSW SAP Portal",
      gstNumber: "29AAACJ4323P1ZS",
      contactPerson: "Vendor Management",
    },
  });

  console.log("✅ Clients created");

  // ─── COMPLIANCE DOC TYPES ─────────────────────────────────────────────────

  const complianceDocTypes = [
    { name: "PF Certificate", description: "Provident Fund Registration Certificate", renewalFrequencyDays: 365 },
    { name: "ESI Certificate", description: "Employee State Insurance Certificate", renewalFrequencyDays: 365 },
    { name: "Labour License", description: "Contract Labour Regulation License", renewalFrequencyDays: 365 },
    { name: "Salary Slips (Last 3 Months)", description: "Engineer salary slips for last 3 months", renewalFrequencyDays: 90 },
    { name: "Professional Tax Certificate", description: "Professional Tax Enrollment Certificate", renewalFrequencyDays: 365 },
    { name: "Insurance Certificate", description: "Workmen Compensation Insurance Certificate", renewalFrequencyDays: 365 },
    { name: "Factory License", description: "Factory Act License", renewalFrequencyDays: 365 },
    { name: "Contractor License", description: "Building & Other Construction Workers License", renewalFrequencyDays: 365 },
    { name: "ISO Certificate", description: "ISO 9001:2015 Quality Management Certification", renewalFrequencyDays: 1095 },
    { name: "OHSAS Certificate", description: "OHSAS 18001 Health & Safety Certificate", renewalFrequencyDays: 1095 },
  ];

  const createdDocTypes: Record<string, string> = {};

  for (const docType of complianceDocTypes) {
    const created = await prisma.complianceDocType.upsert({
      where: { name: docType.name },
      update: {},
      create: {
        ...docType,
        isMandatory: true,
      },
    });
    createdDocTypes[docType.name] = created.id;
  }

  console.log("✅ Compliance doc types created");

  // ─── CLIENT COMPLIANCE REQUIREMENTS ──────────────────────────────────────

  // Tata Steel mandatory docs
  const tataRequiredDocs = [
    "PF Certificate", "ESI Certificate", "Labour License",
    "Salary Slips (Last 3 Months)", "Insurance Certificate"
  ];

  for (const clientId of [tataSteel.id]) {
    for (const docName of tataRequiredDocs) {
      await prisma.clientComplianceRequirement.upsert({
        where: {
          clientId_docTypeId: {
            clientId,
            docTypeId: createdDocTypes[docName],
          },
        },
        update: {},
        create: {
          clientId,
          docTypeId: createdDocTypes[docName],
          isMandatory: true,
        },
      });
    }
  }

  // SAIL mandatory docs
  const sailRequiredDocs = [
    "PF Certificate", "ESI Certificate", "Labour License",
    "Salary Slips (Last 3 Months)", "Insurance Certificate", "Factory License"
  ];

  for (const docName of sailRequiredDocs) {
    await prisma.clientComplianceRequirement.upsert({
      where: {
        clientId_docTypeId: {
          clientId: sail.id,
          docTypeId: createdDocTypes[docName],
        },
      },
      update: {},
      create: {
        clientId: sail.id,
        docTypeId: createdDocTypes[docName],
        isMandatory: true,
      },
    });
  }

  // JSW mandatory docs
  const jswRequiredDocs = [
    "PF Certificate", "ESI Certificate", "Labour License",
    "Salary Slips (Last 3 Months)", "Insurance Certificate"
  ];

  for (const docName of jswRequiredDocs) {
    await prisma.clientComplianceRequirement.upsert({
      where: {
        clientId_docTypeId: {
          clientId: jsw.id,
          docTypeId: createdDocTypes[docName],
        },
      },
      update: {},
      create: {
        clientId: jsw.id,
        docTypeId: createdDocTypes[docName],
        isMandatory: true,
      },
    });
  }

  console.log("✅ Client compliance requirements created");

  // ─── EQUIPMENT ────────────────────────────────────────────────────────────

  const equipment = [
    { name: "TS System 1", serialNumber: "TS-SYS-001", division: Division.TS },
    { name: "TS System 2", serialNumber: "TS-SYS-002", division: Division.TS },
    { name: "LS&S System 1 (Leica)", serialNumber: "LSS-SYS-001", division: Division.LSS },
    { name: "LS&S System 2 (Leica)", serialNumber: "LSS-SYS-002", division: Division.LSS },
  ];

  for (const eq of equipment) {
    await prisma.equipment.upsert({
      where: { serialNumber: eq.serialNumber },
      update: {},
      create: { ...eq, isAvailable: true },
    });
  }

  console.log("✅ Equipment created");
  console.log("\n🎉 Seed completed successfully!");
  console.log("   Default password: SixD@2024");
  console.log("   Default PIN (engineers): 123456");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function upsertUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  roles: Role[];
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      roles: data.roles,
      isActive: true,
    },
  });
}

async function upsertEngineerUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  pinHash: string;
  division: Division;
  level: EngineerLevel;
}) {
  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {},
    create: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      pin: data.pinHash,
      role: Role.FIELD_ENGINEER,
      roles: [Role.FIELD_ENGINEER],
      isActive: true,
    },
  });

  await prisma.engineer.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      division: data.division,
      level: data.level,
    },
  });

  return user;
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
