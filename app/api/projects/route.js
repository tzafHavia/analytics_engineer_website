// app/api/projects/route.js
import { supabase } from '@/lib/supabaseClient';
import { mockProjects } from '@/lib/mockData';

export async function GET() {
  try {
    const { data, error } = await supabase.from('projects').select('*');

    if (error) {
      // Fallback to mock data if table doesn't exist yet
      console.warn('Supabase projects table not found, using mock data:', error.message);
      return Response.json(mockProjects);
    }

    return Response.json(data?.length ? data : mockProjects);
  } catch (err) {
    return Response.json(mockProjects);
  }
}
