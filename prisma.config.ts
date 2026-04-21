import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Grabs the Unraid Docker env var, or falls back to your local Windows file
    url: process.env.DATABASE_URL || "file:./dev.db",
  },
});