import { PrismaPg } from "@prisma/adapter-pg";
import { NoticeLevel, Prisma, PrismaClient } from "@/generated/prisma/client";
import "dotenv/config";

const connectionString = `${process.env.PG_DATABASE_URL}`;

const poolConfig = {
  connectionString,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: 10,
};

const adapter = new PrismaPg(poolConfig);

const prisma = new PrismaClient({
  adapter,
  transactionOptions: { timeout: 10000 },
});

export { adapter, NoticeLevel, prisma, Prisma };
