import { createClient } from '@supabase/supabase-js';

let _adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (_adminClient) return _adminClient;

  const supabaseUrl = process.env.SUPA_BASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('CRITICAL: SUPA_BASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  _adminClient = createClient(supabaseUrl, serviceRoleKey);
  return _adminClient;
}
