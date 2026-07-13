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
    email: "minhd.mbb@gmail.com",
    fullName: "System Admin",
    role: "ADMIN",
  },
  {
    email: "giang.mbbank@gmail.com",
    fullName: "Bank Admin",
    role: "BANK_ADMIN",
  },
  {
    email: "benpoddle@gmail.com",
    accountNo: "1505",
    fullName: "Account Member",
    role: "ACCOUNT",
  },
  {
    email: "bicorgi@gmail.com",
    accountNo: "1403",
    fullName: "Account Member",
    role: "ACCOUNT",
  },
];

for (const user of seedUsers) {
  const savedUser = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      username: user.email,
      fullName: user.fullName,
      role: user.role,
      bankId: bank.id,
      passwordHash,
      isActive: true,
    },
    create: {
      username: user.email,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      bankId: bank.id,
      passwordHash,
      isActive: true,
    },
  });

  if (user.role === "ACCOUNT") {
    if (!user.accountNo) {
      throw new Error(`Missing account number for ${user.email}`);
    }

    await prisma.account.upsert({
      where: { accountNo: user.accountNo },
      update: {
        userId: savedUser.id,
        bankId: bank.id,
        status: "ACTIVE",
      },
      create: {
        accountNo: user.accountNo,
        userId: savedUser.id,
        bankId: bank.id,
      },
    });
  }
}

await prisma.$disconnect();

console.log("Seeded Family Bank users with encrypted passwords.");
