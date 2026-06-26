import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPA_BASE_URL) {
  throw new Error('CRITICAL: Missing Supabase environment variables in .env file.');
}

const supabaseUrl = process.env.SUPA_BASE_URL ;
const supabaseAnonKey = process.env.SUPA_BASE_ANON_PUBLISHABLE_KEY ;

// Safeguard: Fail early during startup if keys are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ SUPABASE ERROR: Environment variables are missing!");
  console.error("Current Working Directory:", process.cwd());
  throw new Error('CRITICAL: Missing Supabase environment variables in .env file.');
}

// Initialize and export the single client instance
const supabase = createClient(supabaseUrl, supabaseAnonKey); // a function that can access the DB through queries
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