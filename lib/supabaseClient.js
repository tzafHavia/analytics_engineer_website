// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Client for the default public schema
export const supabase = createClient(supabaseUrl, supabaseKey);

// Client scoped to shlomy_store schema
export const supabaseStore = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'shlomy_store' },
});
