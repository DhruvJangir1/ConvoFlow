import { Pool } from 'pg'
import { calculatePoolSize } from './calculatePoolSize'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../src/generated/prisma/client'
import dotenv from 'dotenv'
import 'dotenv/config'
dotenv.config();

const maxPoolSize = calculatePoolSize();
export const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: maxPoolSize,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
});

// Supabase requires SSL
pool.options.ssl = { rejectUnauthorized: false };


pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });


export async function shutdownDb() {
  await prisma.$disconnect();
  await pool.end();
}


// Graceful shutdown — close the pool so connections aren't left dangling
// on the Postgres side when the process restarts or redeploys.
async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);