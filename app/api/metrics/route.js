// app/api/metrics/route.js
import { supabase } from '@/lib/supabaseClient';
import { mockMetrics } from '@/lib/mockData';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('metrics_revenue')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.warn('metrics_revenue table not found, using mock data:', error.message);
      return Response.json(mockMetrics);
    }

    return Response.json(data?.length ? data : mockMetrics);
  } catch (err) {
    return Response.json(mockMetrics);
  }
}
