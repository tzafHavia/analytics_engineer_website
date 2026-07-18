import Link from 'next/link';

const GITHUB_URL = 'https://github.com/tzafHavia';
const LINKEDIN_URL = 'https://www.linkedin.com/in/zafrir-havia-409b5323a';

export const metadata = {
  title: 'Zafrir Havia — Analytics Engineer | Portfolio',
  description:
    'Analytics Engineer building end-to-end analytics platforms: Python EL → dbt → Supabase → live Next.js dashboards, on real retail data.',
};

export default function Home() {
  return (
    <div className="page-home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" />
          Analytics Engineering Portfolio
        </div>
        <h1 className="hero-title">
          Zafrir Havia
          <span className="hero-highlight"> — Analytics Engineer</span>
        </h1>
        <p className="hero-subtitle">
          I build end-to-end analytics platforms: <strong>Python EL</strong> →{' '}
          <strong>dbt</strong> → <strong>warehouse</strong> → <strong>live dashboards</strong>.
          Real point-of-sale data, real client impact.
        </p>

        {/* Identity links */}
        <div className="hero-actions" style={{ marginBottom: '0.75rem' }}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            GitHub ↗
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            LinkedIn ↗
          </a>
        </div>

        <div className="hero-actions">
          <Link href="/projects/convenience-store" className="btn-primary btn-lg">
            View the Flagship Project →
          </Link>
          <Link href="/projects/convenience-store/dashboard" className="btn-outline btn-lg">
            Open the Live Dashboard
          </Link>
          {/* TODO (campaign): "Download CV" button — asset pending.
          <a href="/cv.pdf" className="btn-outline btn-lg" download>
            📄 Download CV
          </a>
          */}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="tech-section">
        <h2 className="section-title">Tech Stack</h2>
        <div className="tech-grid">
          {[
            { name: 'dbt', icon: '🔧', desc: 'SQL data transformation' },
            { name: 'SQL', icon: '🗄️', desc: 'Modeling & analytics queries' },
            { name: 'Python', icon: '🐍', desc: 'EL scripts & data processing' },
            { name: 'Supabase', icon: '⚡', desc: 'Postgres warehouse' },
            { name: 'Next.js', icon: '▲', desc: 'Fullstack React framework' },
            { name: 'Recharts', icon: '📊', desc: 'Data visualisation' },
          ].map((t) => (
            <div key={t.name} className="tech-item">
              <span className="tech-item-icon">{t.icon}</span>
              <div>
                <p className="tech-item-name">{t.name}</p>
                <p className="tech-item-desc">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
