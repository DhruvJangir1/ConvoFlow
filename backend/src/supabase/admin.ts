import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPA_BASE_URL ?? (() => {
  throw new Error('CRITICAL: SUPA_BASE_URL environment variable is not set.');
})();

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => {
  throw new Error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.');
})();

const adminClient = createClient(supabaseUrl, serviceRoleKey);
// this is used for admin operations like user management, so we use the service role key which has elevated permissions.
// it should never be exposed to the client side and should only be used in server-side code.
export default adminClient;
