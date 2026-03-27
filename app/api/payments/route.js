// app/api/payments/route.js
import { fetchPayments } from '@/lib/pgClient';

export async function GET() {
  try {
    const rows = await fetchPayments();
    return Response.json({
      data: rows,
      meta: { total: rows.length },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
