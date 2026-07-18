'use client';
import { useState } from 'react';
import ProjectCard from '@/components/ProjectCard';

const ALL_TECHS = ['All', 'SQL', 'dbt', 'Python', 'Next.js', 'Supabase'];

// Client-side search/filter over a server-provided project list.
// The list itself is rendered server-side (initial HTML always contains the
// flagship card — never a "0 projects / loading" state).
export default function ProjectsExplorer({ projects = [] }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const visible = projects.filter((p) => {
    const matchesTech = filter === 'All' || p.tech?.includes(filter);
    const matchesSearch =
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    return matchesTech && matchesSearch;
  });

  return (
    <>
      {/* Controls */}
      <div className="projects-controls">
        <input
          className="search-input"
          placeholder="🔍  Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-pills">
          {ALL_TECHS.map((t) => (
            <button
              key={t}
              className={`filter-pill ${filter === t ? 'filter-pill-active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid — the flagship (first project) renders as a full-width featured card */}
      {visible.length === 0 ? (
        <div className="empty-state">
          <span>🔍</span>
          <p>No projects match your filters.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {visible.map((project, i) => (
            <div
              key={project.id}
              style={i === 0 && project.id === 'convenience-store' ? { gridColumn: '1 / -1' } : undefined}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
