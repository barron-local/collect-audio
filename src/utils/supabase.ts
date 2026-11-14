import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const BUCKET_NAME = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'audio-recordings';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('your-project-id')
);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
    console.log('[Supabase] Initialized directly in Frontend via .env');
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
}

export const supabase = client;
