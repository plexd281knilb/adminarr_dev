// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

// 1. Initialize the native SQLite database connection
// We use the environment variable if available, stripping the "file:" prefix, or default to the local path.
const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('file:', '') 
  : './dev.db';

const sqlite = new Database(dbPath);

// 2. Wrap it in the Prisma 7 Adapter
const adapter = new PrismaBetterSqlite3(sqlite);

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