import Link from 'next/link';

export default function Home() {
  return (
    <div className="page-home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot" />
          Data Analytics Portfolio
        </div>
        <h1 className="hero-title">
          Turning Raw Data Into
          <span className="hero-highlight"> Actionable Insights</span>
        </h1>
        <p className="hero-subtitle">
          Fullstack analytics projects powered by <strong>dbt</strong>,{' '}
          <strong>Supabase</strong>, and <strong>Next.js</strong>. Real data, real results.
        </p>
        <div className="hero-actions">
          <Link href="/projects" className="btn-primary btn-lg">
            Explore Projects →
          </Link>
          <Link href="/payments" className="btn-outline btn-lg">
            Live Data Demo
          </Link>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="tech-section">
        <h2 className="section-title">Tech Stack</h2>
        <div className="tech-grid">
          {[
            { name: 'Next.js', icon: '▲', desc: 'Fullstack React framework' },
            { name: 'Supabase', icon: '⚡', desc: 'Postgres + realtime DB' },
            { name: 'dbt', icon: '🔧', desc: 'SQL data transformation' },
            { name: 'Python', icon: '🐍', desc: 'Data processing & EDA' },
            { name: 'Recharts', icon: '📊', desc: 'Data visualisation' },
            { name: 'Tailwind', icon: '🎨', desc: 'Utility-first CSS' },
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
