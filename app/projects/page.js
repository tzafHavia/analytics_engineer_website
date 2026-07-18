import { supabase } from '@/lib/supabaseClient';
import { mockProjects } from '@/lib/mockData';
import ProjectsExplorer from '@/components/ProjectsExplorer';

export const metadata = {
  title: 'Projects | Zafrir Havia — Analytics Engineer',
  description:
    'Analytics engineering projects: an end-to-end dbt + Supabase + Next.js analytics platform on real retail data, and a multi-system lead-capture integration.',
};

// Server component — the project list is resolved at render time so the initial
// HTML always contains the flagship card (no client fetch, no "0 projects" flash).
async function getProjects() {
  try {
    const { data, error } = await supabase.from('projects').select('*');
    if (error || !data?.length) return mockProjects;
    return data;
  } catch (_) {
    return mockProjects;
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="page-projects">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-accent">Analytics</span> Projects
        </h1>
        <p className="page-desc">
          {projects.length} projects showcasing real-world data engineering and analytics work.
        </p>
      </div>

      <ProjectsExplorer projects={projects} />
    </div>
  );
}
