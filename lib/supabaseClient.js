// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

// Schema names read from env — DB_SCHEMA is server-side only (no NEXT_PUBLIC_ needed for API routes)
const paymentsSchema = process.env.NEXT_DB_SCHEMA || 'store_pipeline';

// Client for the default public schema
export const supabase = createClient(supabaseUrl, supabaseKey);

// Client scoped to the payments/pipeline schema (e.g. store_pipeline or shlomy_store)
export const supabaseStore = createClient(supabaseUrl, supabaseKey, {
  db: { schema: paymentsSchema },
});
