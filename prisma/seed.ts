// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });