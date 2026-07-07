import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const passwordHash = await bcrypt.hash("1234", 12);

const bank = await prisma.bank.upsert({
  where: { code: "FAMILY" },
  update: { name: "Family Bank", isActive: true },
  create: {
    code: "FAMILY",
    name: "Family Bank",
    isActive: true,
  },
});

const seedUsers = [
  {
    username: "0983171982",
    fullName: "System Admin",
    role: "ADMIN",
  },
  {
    username: "0922076868",
    fullName: "Bank Admin",
    role: "BANK_ADMIN",
  },
  {
    username: "1505",
    fullName: "Account 1505",
    role: "ACCOUNT",
  },
  {
    username: "1403",
    fullName: "Account 1403",
    role: "ACCOUNT",
  },
];

for (const user of seedUsers) {
  const savedUser = await prisma.user.upsert({
    where: { username: user.username },
    update: {
      fullName: user.fullName,
      role: user.role,
      bankId: bank.id,
      passwordHash,
      isActive: true,
    },
    create: {
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      bankId: bank.id,
      passwordHash,
      isActive: true,
    },
  });

  if (user.role === "ACCOUNT") {
    await prisma.account.upsert({
      where: { accountNo: user.username },
      update: {
        userId: savedUser.id,
        bankId: bank.id,
        status: "ACTIVE",
      },
      create: {
        accountNo: user.username,
        userId: savedUser.id,
        bankId: bank.id,
      },
    });
  }
}

await prisma.$disconnect();

console.log("Seeded Family Bank users with encrypted passwords.");
