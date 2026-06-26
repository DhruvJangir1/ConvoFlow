import { createClient } from '@supabase/supabase-js';

if (!import.meta.env.VITE_SUPA_BASE_URL) {
  throw new Error('CRITICAL: Missing Supabase environment variables in .env file.');
}

const supabaseUrl = import.meta.env.VITE_SUPA_BASE_URL ;
const supabaseAnonKey = import.meta.env.VITE_SUPA_BASE_ANON_PUBLISHABLE_KEY ;


if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('CRITICAL: Missing Supabase environment variables in .env file.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getUserById(userId:string) {
  const storedUserId = userId;

  const { data, error } = await supabase
    .from('USERS')
    .select('id, email, balance, created_at, is_verified')
    .eq('id', storedUserId)
    .single();

  return { data, error };
}

export default supabase;