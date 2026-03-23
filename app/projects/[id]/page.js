'use client';
import { useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/components/Loader';

const techColors = {
  SQL: 'tech-sql',
  dbt: 'tech-dbt',
  Python: 'tech-python',
  'Next.js': 'tech-next',
  Supabase: 'tech-supabase',
  Recharts: 'tech-recharts',
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <Loader text="Loading project..." />;
  if (error || !project) return (
    <div className="error-state">
      <h2>Project not found</h2>
      <Link href="/projects" className="btn-primary">← Back to projects</Link>
    </div>
  );

  return (
    <div className="page-detail">
      {/* Back */}
      <Link href="/projects" className="back-link">← All Projects</Link>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-meta">
          <span className="detail-category">{project.category}</span>
          <span className={`card-status card-status-${project.status}`}>
            {project.status === 'live' ? '● Live' : '○ Draft'}
          </span>
        </div>
        <h1 className="detail-title">{project.title}</h1>
        <p className="detail-description">{project.description}</p>

        {/* Tech stack */}
        <div className="card-tech-stack">
          {project.tech?.map((t) => (
            <span key={t} className={`tech-badge ${techColors[t] || 'tech-default'}`}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Insights */}
      {project.insights?.length > 0 && (
        <div className="detail-section">
          <h2 className="detail-section-title">📊 Key Insights</h2>
          <ul className="insights-list">
            {project.insights.map((insight, i) => (
              <li key={i} className="insight-item">
                <span className="insight-bullet">✦</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dashboard embed */}
      {project.dashboard_url && (
        <div className="detail-section">
          <h2 className="detail-section-title">📈 Dashboard</h2>
          <div className="dashboard-embed-wrapper">
            <iframe
              src={project.dashboard_url}
              className="dashboard-embed"
              title={`${project.title} dashboard`}
              allow="fullscreen"
            />
          </div>
        </div>
      )}

      {/* Links */}
      <div className="detail-actions">
        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            View on GitHub ↗
          </a>
        )}
        <Link href="/projects" className="btn-ghost">← Back</Link>
      </div>
    </div>
  );
}
