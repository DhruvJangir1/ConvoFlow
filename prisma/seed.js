import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Client } = pg;

const supabaseUrl = 'https://fvrbxglgvllfrcblqtum.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2cmJ4Z2xndmxsZnJjYmxxdHVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUxNDg3NywiZXhwIjoyMDk2MDkwODc3fQ.e1KtVLj0jFJ6M8OPf5EdabXQwdIKmIrEz_u2aSsTbOw';
const databaseUrl = 'postgresql://postgres.fvrbxglgvllfrcblqtum:d%40%5B%3E%2FPx%2Am%25xJkle%2A%2124ctEr@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  {
    email: 'john@example.com',
    password: 'Password123!',
    user_name: 'johndoe',
    image_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=johndoe',
    is_verified: true,
  },
  {
    email: 'jane@example.com',
    password: 'Password123!',
    user_name: 'janesmith',
    image_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=janesmith',
    is_verified: true,
  },
  {
    email: 'alice@example.com',
    password: 'Password123!',
    user_name: 'alicewonder',
    image_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=alicewonder',
    is_verified: true,
  },
  {
    email: 'bob@example.com',
    password: 'Password123!',
    user_name: 'bob_builder',
    image_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=bob_builder',
    is_verified: false,
  },
];

async function getOrCreateAuthUserId(user) {
  // Try to create the auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: user.is_verified,
    user_metadata: { user_name: user.user_name },
  });

  if (data?.user) return data.user.id;

  // If already exists, look it up
  if (error?.message?.includes('already exists')) {
    const { data: existing } = await supabase.auth.admin.getUserByEmail(user.email);
    if (existing?.user) return existing.user.id;
  }

  throw new Error(`Failed to create/lookup auth user ${user.email}: ${error?.message}`);
}

async function runSeed() {
  const pgClient = new Client({ connectionString: databaseUrl });
  await pgClient.connect();

  for (const user of users) {
    try {
      const authUserId = await getOrCreateAuthUserId(user);

      const hashedPassword = '$2b$12$FcO0..aXbPoI5q9jWWFGUeJN2OlkqmKJwGKFF8GkGvGoFCbEx0Dc2';

      await pgClient.query(
        `INSERT INTO "USERS" (id, user_name, email, password, image_url, is_verified, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, clock_timestamp(), clock_timestamp())
         ON CONFLICT (email) DO UPDATE SET
           user_name = EXCLUDED.user_name,
           password = EXCLUDED.password,
           image_url = EXCLUDED.image_url,
           is_verified = EXCLUDED.is_verified`,
        [authUserId, user.user_name, user.email, hashedPassword, user.image_url, user.is_verified],
      );

      console.log(`Seeded user: ${user.user_name}`);
    } catch (err) {
      console.error(`Error seeding ${user.email}:`, err.message);
    }
  }

  await pgClient.end();
  console.log('Seeding complete!');
}

runSeed().catch(console.error);
