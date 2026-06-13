// app/api/revalidate/route.js
// Cache-invalidation webhook for the store_pipeline data loader.
// After a successful Supabase load, the pipeline POSTs here to flush the
// dashboard Data Cache immediately, instead of waiting for the unstable_cache
// TTL. All dashboard fetch functions are tagged 'dashboard' (see
// lib/dashboardData.js), so one revalidateTag call refreshes every tab.
//
// Auth: shared secret in the `x-revalidate-secret` header, compared to
// NEXT_REVALIDATE_SECRET (.env.local — never commit the value).
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic'; // never cache this endpoint itself

export async function POST(request) {
  const expected = process.env.NEXT_REVALIDATE_SECRET;
  if (!expected) {
    return Response.json(
      { revalidated: false, error: 'NEXT_REVALIDATE_SECRET not configured' },
      { status: 500 }
    );
  }

  const provided = request.headers.get('x-revalidate-secret');
  if (provided !== expected) {
    return Response.json({ revalidated: false, error: 'unauthorized' }, { status: 401 });
  }

  revalidateTag('dashboard');
  return Response.json({
    revalidated: true,
    tag: 'dashboard',
    at: new Date().toISOString(),
  });
}
