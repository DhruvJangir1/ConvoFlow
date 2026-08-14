import { createClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (adminClient) {
    console.log('[admin] Returning cached Supabase admin client');
    return adminClient;
  }

  const supabaseUrl = process.env.SUPA_BASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[admin] SUPA_BASE_URL exists:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('[admin] SUPABASE_SERVICE_ROLE_KEY exists:', serviceRoleKey ? 'SET' : 'MISSING');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[admin] CRITICAL: Missing env vars');
    throw new Error('CRITICAL: SUPA_BASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey.trim());
  console.log('[admin] Supabase admin client created successfully');
  return adminClient;
}
