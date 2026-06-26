import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL,
  });
  pool.options.ssl = { rejectUnauthorized: false };

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Backfilling user tags...');

  const users = await prisma.users.findMany({
    orderBy: { created_at: 'asc' },
  });

  console.log(`Found ${users.length} users`);

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const tagNumber = i + 1;
    const tag = `${user.user_name.toLowerCase()}#${String(tagNumber).padStart(4, '0')}`;

    await prisma.users.update({
      where: { id: user.id },
      data: { user_tag: tag },
    });

    if ((i + 1) % 100 === 0) {
      console.log(`Processed ${i + 1}/${users.length} users`);
    }
  }

  console.log(`Tagged ${users.length} users successfully`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
