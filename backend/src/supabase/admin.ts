import { createClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (adminClient) {
    console.log('[admin] Returning cached Supabase admin client');
    return adminClient;
  }

  const supabaseUrl = process.env.SUPA_BASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[admin] SUPA_BASE_URL exists:', supabaseUrl);
  console.log('[admin] SUPABASE_SERVICE_ROLE_KEY exists:', serviceRoleKey);

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin] CRITICAL: Missing env vars');
    console.error('[admin] SUPA_BASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.error('[admin] SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'MISSING');
    throw new Error('CRITICAL: SUPA_BASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const trimmedKey = serviceRoleKey.trim();
  const startsWithEyJ = trimmedKey.startsWith('eyJ');
  console.log(`[admin] Key length: ${trimmedKey.length}`);
  console.log(`[admin] Key starts with "eyJ": ${startsWithEyJ}`);
  console.log(`[admin] Key first 10 chars: "${trimmedKey.slice(0, 10)}..."`);
  console.log(`[admin] Key last 5 chars: "...${trimmedKey.slice(-5)}"`);

  if (!startsWithEyJ) {
    console.error('[admin] WARNING: Key does NOT start with "eyJ" — this is likely NOT a valid Supabase JWT');
    console.error('[admin] Possible issues:');
    console.error('[admin]   1. You set the JWT Secret (sb_secret) instead of the service_role key');
    console.error('[admin]   2. You set the anon key instead of the service_role key');
    console.error('[admin]   3. The key has invisible characters or is truncated');
  }

  console.log(`[admin] SUPA_BASE_URL: "${supabaseUrl}"`);

  adminClient = createClient(supabaseUrl, trimmedKey);
  console.log('[admin] Supabase admin client created successfully');
  return adminClient;
}
