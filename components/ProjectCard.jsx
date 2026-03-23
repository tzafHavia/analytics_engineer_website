import Link from 'next/link';

const techColors = {
  SQL: 'tech-sql',
  dbt: 'tech-dbt',
  Python: 'tech-python',
  'Next.js': 'tech-next',
  Supabase: 'tech-supabase',
  Recharts: 'tech-recharts',
};

const categoryIcons = {
  Sales: '💰',
  Marketing: '📣',
  Finance: '💳',
  Analytics: '📈',
};

export default function ProjectCard({ project }) {
  return (
    <div className="project-card">
      {/* Header */}
      <div className="card-header">
        <span className="card-category-icon">
          {categoryIcons[project.category] || '🔍'}
        </span>
        <span className={`card-status card-status-${project.status}`}>
          {project.status === 'live' ? '● Live' : '○ Draft'}
        </span>
      </div>

      {/* Title */}
      <h3 className="card-title">{project.title}</h3>

      {/* Description */}
      <p className="card-description">{project.description}</p>

      {/* Tech stack badges */}
      <div className="card-tech-stack">
        {project.tech?.map((t) => (
          <span key={t} className={`tech-badge ${techColors[t] || 'tech-default'}`}>
            {t}
          </span>
        ))}
      </div>

      {/* Insights preview */}
      {project.insights?.length > 0 && (
        <div className="card-insight">
          <span className="insight-label">Key Insight</span>
          <p className="insight-text">✦ {project.insights[0]}</p>
        </div>
      )}

      {/* Actions */}
      <div className="card-actions">
        <Link href={project.href || `/projects/${project.id}`} className="btn-primary">
          View Details →
        </Link>
        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            GitHub ↗
          </a>
        )}
      </div>
    </div>
  );
}
