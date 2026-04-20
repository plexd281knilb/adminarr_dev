import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL || "file:./dev.db";
  
  // In Prisma 7, we pass the URL directly to the new adapter
  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Preserve the existing client in development to prevent connection exhaustion
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;