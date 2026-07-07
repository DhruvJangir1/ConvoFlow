import dotenv from 'dotenv';
import 'dotenv/config'
dotenv.config();
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: String(process.env.VITE_DIRECT_URL) || String(process.env.DATABASE_URL),
  },
  migrations: {
    path: "prisma/migrations"
  },
});