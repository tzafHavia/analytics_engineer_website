import Link from 'next/link';
import Image from 'next/image';

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

const categoryGradients = {
  Sales: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(34,211,238,0.15))',
  Marketing: 'linear-gradient(135deg, rgba(251,146,60,0.25), rgba(250,204,21,0.1))',
  Finance: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(34,211,238,0.12))',
  Analytics: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))',
};

export default function ProjectCard({ project }) {
  return (
    <div className="project-card">
      {/* Image area */}
      <div className="card-image-area">
        {project.image ? (
          <Image
            src={project.image}
            alt={project.title}
            fill
            className="card-image-img"
            sizes="320px"
          />
        ) : (
          <div
            className="card-image-placeholder"
            style={{ background: categoryGradients[project.category] || 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(34,211,238,0.1))' }}
          >
            <span className="card-placeholder-icon">{categoryIcons[project.category] || '🔍'}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="card-content">
        {/* Header */}
        <div className="card-header">
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
    </div>
  );
}
