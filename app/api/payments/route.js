// app/api/payments/route.js
// Reads from shlomy_store.payments_complete via the scoped Supabase client
import { supabaseStore } from '@/lib/supabaseClient';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseStore
    .from('payments_complete')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    data,
    meta: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
    },
  });
}
