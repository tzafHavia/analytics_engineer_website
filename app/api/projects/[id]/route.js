// app/api/projects/[id]/route.js
import { supabase } from '@/lib/supabaseClient';
import { mockProjects } from '@/lib/mockData';

export async function GET(request, { params }) {
  const { id } = await params;

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      const mock = mockProjects.find((p) => String(p.id) === String(id));
      if (!mock) return Response.json({ error: 'Project not found' }, { status: 404 });
      return Response.json(mock);
    }

    return Response.json(data);
  } catch (err) {
    const mock = mockProjects.find((p) => String(p.id) === String(id));
    if (!mock) return Response.json({ error: 'Project not found' }, { status: 404 });
    return Response.json(mock);
  }
}
