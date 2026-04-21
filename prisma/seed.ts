// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

// 1. Get the connection URL (falling back to a local dev db)
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

// 2. Initialize the Prisma 7 Adapter
// CRITICAL FIX: The adapter expects a config object with the URL!
const adapter = new PrismaBetterSqlite3({ url: dbUrl });

// 3. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = 'admin@adminarr.local';
  
  // Check if admin already exists so we don't duplicate or overwrite it
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminarr2026', 10);
    
    await prisma.user.create({
      data: {
        username: 'admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('✅ Default admin created: admin@adminarr.local / adminarr2026');
  } else {
    console.log('⚡ Admin user already exists. Skipping seed.');
  }

  // Ensure default Settings row exists
  const existingSettings = await prisma.settings.findUnique({
    where: { id: 'global' },
  });

  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        id: 'global',
        theme: 'dark',
      },
    });
    console.log('✅ Default global settings initialized.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });