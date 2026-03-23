'use client';
import { useState, useEffect } from 'react';
import ProjectCard from '@/components/ProjectCard';
import Loader from '@/components/Loader';

const ALL_TECHS = ['All', 'SQL', 'dbt', 'Python', 'Next.js', 'Supabase', 'Recharts'];

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const visible = projects.filter((p) => {
    const matchesTech = filter === 'All' || p.tech?.includes(filter);
    const matchesSearch =
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    return matchesTech && matchesSearch;
  });

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

      {/* Grid */}
      {loading ? (
        <Loader text="Loading projects..." />
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <span>🔍</span>
          <p>No projects match your filters.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
