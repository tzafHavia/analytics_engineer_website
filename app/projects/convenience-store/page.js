import Image from 'next/image';
import Link from 'next/link';
import { fetchDailySales } from '@/lib/pgClient';
import { fetchCaseStudyData } from '@/lib/dashboardData';
import DailySalesChart from '@/components/DailySalesChart';
import CaseStudyEmployeeHoursChart from '@/components/CaseStudyEmployeeHoursChart';
import CaseStudyCategoryChart from '@/components/CaseStudyCategoryChart';
import CaseStudyWeeklyTrendChart from '@/components/CaseStudyWeeklyTrendChart';

// ─── Formatting helpers (live KPI values) ────────────────────────────────────
function fmtShekel(v, digits = 0) {
  if (v == null) return null;
  return `₪${Number(v).toLocaleString('he-IL', { maximumFractionDigits: digits })}`;
}

function fmtShekelCompact(v) {
  if (v == null) return null;
  return `₪${Number((v / 1000).toFixed(1))}k`;
}

function fmtPct(v, digits = 1) {
  if (v == null) return null;
  return `${Number(v).toFixed(digits)}%`;
}

// ─── Metric KPI card ─────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color, rtlValue = false }) {
  return (
    <div className={`cs-metric-card cs-metric-${color}`}>
      <span className="cs-metric-icon">{icon}</span>
      <p className="cs-metric-label">{label}</p>
      <p className="cs-metric-value" dir={rtlValue ? 'rtl' : undefined}>{value}</p>
      {sub && <p className="cs-metric-sub">{sub}</p>}
    </div>
  );
}

// ─── Pipeline step ────────────────────────────────────────────────────────────
function PipelineStep({ icon, title, desc, color }) {
  return (
    <div className={`cs-pipeline-step cs-pipe-${color}`}>
      <span className="cs-pipe-icon">{icon}</span>
      <div>
        <p className="cs-pipe-title">{title}</p>
        <p className="cs-pipe-desc">{desc}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export const metadata = {
  title: 'Convenience Store Analytics Platform | Zafrir Havia',
  description:
    'End-to-end analytics platform on real point-of-sale data: Python EL → dbt → Supabase → live Next.js dashboard, refreshed nightly.',
};

export default async function ConvenienceStorePage() {
  let dailySales = [];
  try {
    dailySales = await fetchDailySales();
  } catch (_) {
    dailySales = [];
  }

  // Live case-study metrics — computed from the same store_pipeline read-set the
  // dashboard uses. Any null field simply drops its KPI card (never a "—").
  let caseStudy = null;
  try {
    caseStudy = await fetchCaseStudyData();
  } catch (_) {
    caseStudy = null;
  }
  const kpis = caseStudy?.kpis ?? {};
  const asOf = caseStudy?.asOf ?? null;

  // KPI card definitions — value null → card not rendered (real values only).
  const financialCards = [
    { icon: '🛒', label: 'Avg. Basket Size', value: fmtShekel(kpis.avgBasketSize, 1), sub: 'Per transaction · 30d', color: 'purple' },
    { icon: '⏱️', label: 'Revenue / Hour', value: fmtShekel(kpis.revenuePerHour), sub: 'Per trading hour · 30d', color: 'cyan' },
    { icon: '📊', label: 'Gross Margin', value: fmtPct(kpis.grossMarginPct), sub: 'Estimated · 30d', color: 'green' },
    { icon: '💳', label: 'Daily Revenue', value: fmtShekel(kpis.avgDailyRevenue), sub: 'Daily average · 30d', color: 'orange' },
  ].filter((c) => c.value != null);

  const productCards = [
    {
      icon: '🏆', label: 'Top SKU', value: kpis.topSkuName, rtlValue: true,
      sub: kpis.topSkuRevenue != null ? `${fmtShekelCompact(kpis.topSkuRevenue)} · 30d revenue` : 'By 30d revenue',
      color: 'purple',
    },
    { icon: '📉', label: 'Low Performers', value: kpis.lowPerformersCount != null ? Number(kpis.lowPerformersCount).toLocaleString('he-IL') : null, sub: 'Slow / no-recent-sales items', color: 'orange' },
    {
      icon: '🗂️', label: 'Top Category', value: kpis.topCategoryName, rtlValue: true,
      sub: kpis.topCategorySharePct != null ? `${fmtPct(kpis.topCategorySharePct)} of 30d revenue` : 'By 30d revenue',
      color: 'cyan',
    },
  ].filter((c) => c.value != null);

  const timeCards = [
    { icon: '📈', label: 'Peak Hour', value: kpis.peakHourLabel, sub: 'Highest sales · 30d', color: 'cyan' },
    { icon: '📅', label: 'Peak Day', value: kpis.peakDayLabel, sub: 'Highest avg daily sales · 30d', color: 'green' },
    { icon: '🌙', label: 'Evening Share', value: fmtPct(kpis.eveningSharePct), sub: 'Revenue rung 16:00+ · 30d', color: 'purple' },
  ].filter((c) => c.value != null);

  const hasAnyKpi = financialCards.length + productCards.length + timeCards.length > 0;

  return (
    <div className="cs-page">

      {/* ── Back ─────────────────────────────────────────────────────── */}
      <Link href="/projects" className="back-link">← All Projects</Link>

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-hero">
        <div className="cs-hero-inner">
          <div className="cs-hero-eyebrow">
            <span className="eyebrow-dot" />
            Analytics Engineering · Data Modeling · Business Intelligence
          </div>
          <h1 className="cs-hero-title">
            Convenience Store
            <span className="hero-highlight"> Analytics Platform</span>
          </h1>
          <p className="cs-hero-subtitle">
            An end-to-end analytics platform built on real point-of-sale data from a working
            convenience store — a client also served directly with recurring reports (weekly
            sales-by-hour, employee hours, weekly/monthly summaries, and a year-end report).
            Python EL → dbt → Supabase → live Next.js dashboard, refreshed nightly. The full
            platform is a portfolio extension built on the same data.
          </p>

          {/* Tech badges */}
          <div className="card-tech-stack cs-hero-tech">
            {['SQL', 'dbt', 'Supabase', 'Next.js', 'Python'].map((t) => (
              <span
                key={t}
                className={`tech-badge tech-${t.toLowerCase().replace('.', '').replace(' ', '')}`}
              >
                {t}
              </span>
            ))}
          </div>

          {/* Buttons */}
          <div className="cs-hero-actions">
            <Link href="/projects/convenience-store/dashboard" className="btn-primary btn-dashboard-cta">
              📊 Open Live Dashboard ↗
            </Link>
            <a
              href="https://github.com/tzafHavia/local_store_pipeline"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              GitHub ↗
            </a>
            <a
              href="/dbt-docs/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              📚 dbt Docs ↗
            </a>
          </div>
        </div>

        {/* Status + scope badges */}
        <div className="cs-hero-badges">
          <span className="card-status card-status-live">● Live Project</span>
          <span className="cs-scope-badge">🏪 Retail</span>
          <span className="cs-scope-badge">📊 BI</span>
          <span className="cs-scope-badge">🔄 ELT</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          ARCHITECTURE DIAGRAM
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Data Architecture</h2>
        <p className="cs-section-subtitle">
          Raw POS data is extracted and loaded nightly (EL), transformed with dbt,
          published to Supabase as a controlled read-set, and served through a Next.js
          API to the live executive dashboard.
        </p>

        {/* Pipeline pills */}
        <div className="cs-pipeline">
          <PipelineStep icon="🖥️" title="POS System" desc="Verifone – nightly export at 03:00" color="blue" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="🔧" title="dbt Models" desc="Staging · Intermediate · Marts" color="orange" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="⚡" title="Supabase" desc="PostgreSQL data warehouse" color="green" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="▲" title="Next.js API" desc="Controlled data access layer" color="purple" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="📊" title="Dashboards" desc="Next.js Executive Dashboard (5 views)" color="cyan" />
        </div>

        {/* Architecture image */}
        <div className="cs-arch-image-wrapper">
          <Image
            src="/images/architecture-diagram.png"
            alt="End-to-End Data Pipeline Architecture"
            width={1200}
            height={700}
            className="cs-arch-image"
            priority
          />
          <p className="cs-arch-caption">
            Fig 1. End-to-End Data Pipeline Architecture — POS → dbt → Supabase → API → Dashboard
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          BY THE NUMBERS  (verified engineering facts)
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">By the Numbers</h2>
        <p className="cs-section-subtitle">
          Verified engineering facts from the pipeline repository.
        </p>
        <div className="kpi-section cs-metrics-row">
          <MetricCard icon="🔧" label="dbt Models" value="42" sub="Staging → intermediate → marts" color="purple" />
          <MetricCard icon="✅" label="Data Tests" value="220+" sub="Freshness · uniqueness · reconciliation" color="green" />
          <MetricCard icon="🕐" label="SCD Type-2 Snapshots" value="2" sub="Price history · inventory balance" color="cyan" />
          <MetricCard icon="🌙" label="Nightly Run" value="03:00" sub="Extract → dbt build → publish → revalidate" color="orange" />
        </div>
        <div className="kpi-section cs-metrics-row" style={{ marginTop: '1rem' }}>
          <MetricCard icon="📦" label="Published Read-Set" value="20 tables" sub="Copy-only DML · zero DDL in prod" color="cyan" />
          <MetricCard icon="⚙️" label="CI Pipeline" value="~45s" sub="Full dbt build + tests on seeded fixture" color="purple" />
          <MetricCard icon="🗜️" label="Prod Slimming" value="539 → 8" sub="Raw tables (PostgREST storm diagnosed)" color="orange" />
          <MetricCard icon="💾" label="Database Size" value="116 → 46 MB" sub="After the free-tier IO cutover" color="green" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          THE PROBLEM
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">The Problem</h2>
        <p className="cs-section-subtitle">
          In the fast-paced world of retail, convenience store owners often struggle with
          fragmented data spread across inventory logs and sales receipts. Without a
          centralized &ldquo;Single Source of Truth,&rdquo; it&rsquo;s nearly impossible to identify
          low-stock risks, track real-time profitability, or understand customer buying
          patterns.
        </p>
        <div className="cs-problem-grid">
          <div className="cs-problem-card">
            <span className="cs-problem-icon">📤</span>
            <h3>Poor Data Export</h3>
            <p>
              The POS system did not export data in a format suitable for accounting or
              reporting.
            </p>
          </div>
          <div className="cs-problem-card">
            <span className="cs-problem-icon">💸</span>
            <h3>High Vendor Costs</h3>
            <p>
              Verifone offered advanced reporting features, but at an expensive recurring
              monthly cost.
            </p>
          </div>
          <div className="cs-problem-card">
            <span className="cs-problem-icon">📉</span>
            <h3>Limited Built-in Reports</h3>
            <p>
              The existing reports were too basic and could not support real business
              analysis or decision-making.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          BUSINESS REQUIREMENTS
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Business Requirements</h2>
        <p className="cs-section-subtitle">
          The client defined three types of recurring business reports — these are the
          deliverables served directly to the client on an ongoing basis.
        </p>
        <div className="cs-req-grid">
          <div className="cs-req-card cs-req-monthly">
            <div className="cs-req-header">
              <span>📅</span>
              <h3>Monthly Reports</h3>
            </div>
            <ul>
              <li>Employee working hours report</li>
              <li>Employee compensation report</li>
            </ul>
          </div>
          <div className="cs-req-card cs-req-annual">
            <div className="cs-req-header">
              <span>📦</span>
              <h3>Annual Report</h3>
            </div>
            <ul>
              <li>Inventory report (stock levels &amp; movement)</li>
            </ul>
          </div>
          <div className="cs-req-card cs-req-weekly">
            <div className="cs-req-header">
              <span>📈</span>
              <h3>Weekly Insights</h3>
            </div>
            <p className="cs-req-note">Every Sunday — previous week</p>
            <ul>
              <li>Total sales per day</li>
              <li>Total costs per day</li>
              <li>Profit per day</li>
              <li>Top 10 selling products</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SOLUTION
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Solution</h2>
        <p className="cs-section-subtitle">
          I built a robust, scalable data platform that turns raw operational data into
          reliable reporting. The client receives the recurring reports built on this
          pipeline; the dbt project and live dashboard extend the same data into a
          full portfolio-grade analytics platform.
        </p>
        <div className="cs-solution-grid">
          {[
            { icon: '🔄', title: 'Automated Ingestion (EL)', desc: 'Nightly job extracts POS backups at 03:00 and loads raw data into the warehouse — extract and load first, transform downstream.' },
            { icon: '🔧', title: 'dbt Transformations (T)', desc: 'Staging models clean and normalize raw data. Mart models build fact and dimension tables. Metric models compute business KPIs.' },
            { icon: '⚡', title: 'Supabase Warehouse', desc: 'Transformed data is published to a structured PostgreSQL database on Supabase as a controlled 20-table read-set.' },
            { icon: '▲', title: 'Next.js API Layer', desc: 'A controlled API layer exposes the data to the dashboard UI, with filtering and pagination built in.' },
            { icon: '📊', title: 'Live Executive Dashboard', desc: 'Five interactive views — Overview, Sales, Inventory, Products, Workforce — refreshed nightly from the pipeline.' },
          ].map((s, i) => (
            <div key={i} className="cs-solution-step">
              <div className="cs-solution-num">{i + 1}</div>
              <span className="cs-solution-icon">{s.icon}</span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TECHNICAL DEEP DIVE
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Technical Architecture & Workflow</h2>
        <p className="cs-section-subtitle">
          Each layer of the stack was chosen deliberately — from raw data ingestion to
          the final visual layer served to stakeholders.
        </p>
        <div className="cs-tech-deepdive-grid">
          <div className="cs-td-card">
            <span className="cs-td-icon">⚡</span>
            <div>
              <h4 className="cs-td-title">Storage &amp; Cloud DB</h4>
              <p className="cs-td-desc">
                Utilized <strong>Supabase (PostgreSQL)</strong> as the primary data
                warehouse, ensuring high availability and seamless cloud integration.
              </p>
            </div>
          </div>
          <div className="cs-td-card">
            <span className="cs-td-icon">🔧</span>
            <div>
              <h4 className="cs-td-title">Data Transformation — dbt</h4>
              <p className="cs-td-desc">
                Engineered a multi-layered modeling architecture (Staging, Intermediate,
                and Marts). Implemented rigorous data quality tests and documentation to
                ensure every KPI is accurate and reliable.
              </p>
            </div>
          </div>
          <div className="cs-td-card">
            <span className="cs-td-icon">🗄️</span>
            <div>
              <h4 className="cs-td-title">Analytics Engineering</h4>
              <p className="cs-td-desc">
                Developed complex SQL models to calculate high-impact metrics like
                Inventory Turnover, Category Performance, and Profit Margins.
              </p>
            </div>
          </div>
          <div className="cs-td-card">
            <span className="cs-td-icon">📊</span>
            <div>
              <h4 className="cs-td-title">Visual Intelligence</h4>
              <p className="cs-td-desc">
                Built a custom <strong>Next.js + Recharts executive dashboard</strong> with
                five live views (Overview, Sales, Inventory, Products, Workforce) reading a
                20-table published Supabase read-set — URL-based tabs, global date/category
                filters, and nightly cache revalidation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          KEY DASHBOARDS  (live data)
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Key Dashboards</h2>
        <p className="cs-section-subtitle">
          Four of the platform&rsquo;s views, rendered here from the live Supabase read-set
          {asOf ? ` (data as of ${asOf})` : ''}. The full five-view dashboard is one
          click away.
        </p>

        <div className="cs-dashboards-grid">

          {/* Dashboard 1 — Sales (Live) */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>🏪</span> Sales Performance Dashboard
            </div>
            <p className="cs-db-desc">
              Daily revenue totals computed from <code>store_pipeline.rpt_daily_sales</code> —
              each bar represents one trading day.
            </p>
            <DailySalesChart data={dailySales} />
          </div>

          {/* Dashboard 2 — Employee (Live) */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>👥</span> Employee Analytics Dashboard
            </div>
            <p className="cs-db-desc">
              Total worked hours per employee from the workforce productivity summary —
              the same source behind the dashboard&rsquo;s Workforce view.
            </p>
            <CaseStudyEmployeeHoursChart data={caseStudy?.employeeHours ?? []} />
          </div>

          {/* Dashboard 3 — Inventory / Products (Live) */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>📦</span> Category Revenue Contribution
            </div>
            <p className="cs-db-desc">
              Trailing 30-day revenue share by product category, live from the category
              performance mart.
            </p>
            <CaseStudyCategoryChart data={caseStudy?.categoryRevenue ?? []} />
          </div>

          {/* Dashboard 4 — Weekly Summary (Live) */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>📅</span> Weekly Summary Dashboard
            </div>
            <p className="cs-db-desc">
              Weekly net sales and ticket counts (last 12 weeks) — mirroring the weekly
              summary report delivered to the client every Sunday.
            </p>
            <CaseStudyWeeklyTrendChart data={caseStudy?.weeklyTrend ?? []} />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          ADVANCED METRICS  (live values)
      ══════════════════════════════════════════════════════════════ */}
      {hasAnyKpi && (
        <section className="cs-section">
          <h2 className="cs-section-title">Advanced Metrics & KPIs</h2>
          <p className="cs-section-subtitle">
            Computed live from the reporting tables over the trailing 30 days
            {asOf ? ` (as of ${asOf})` : ''}.
          </p>

          {financialCards.length > 0 && (
            <>
              <h3 className="cs-metrics-group-title">💰 Financial</h3>
              <div className="kpi-section cs-metrics-row">
                {financialCards.map((c) => <MetricCard key={c.label} {...c} />)}
              </div>
            </>
          )}

          {productCards.length > 0 && (
            <>
              <h3 className="cs-metrics-group-title" style={{ marginTop: '2rem' }}>🛒 Product Analytics</h3>
              <div className="kpi-section cs-metrics-row">
                {productCards.map((c) => <MetricCard key={c.label} {...c} />)}
              </div>
            </>
          )}

          {timeCards.length > 0 && (
            <>
              <h3 className="cs-metrics-group-title" style={{ marginTop: '2rem' }}>⏰ Time-Based Insights</h3>
              <div className="kpi-section cs-metrics-row">
                {timeCards.map((c) => <MetricCard key={c.label} {...c} />)}
              </div>
            </>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          KEY INSIGHTS
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Key Insights</h2>
        <div className="insights-list">
          {[
            'Revenue is heavily concentrated: the top category alone accounts for roughly two-thirds of trailing-30-day sales (Pareto principle confirmed)',
            'Overnight hours (~00:30–05:30) consistently failed to cover wages — especially weekends at premium shift pay — which drove the two-shift staffing recommendation',
            'A long tail of slow and no-recent-sales items ties up inventory capital — surfaced as a live "low performers" count and a dead-stock action list',
            'Employee productivity varied significantly between shifts and individuals — attributed sales per worked hour make the gap visible',
          ].map((ins, i) => (
            <div key={i} className="insight-item">
              <span className="insight-bullet">✦</span>
              <span>{ins}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          BUSINESS IMPACT
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Business Impact</h2>
        <div className="cs-impact-grid">
          {[
            { icon: '💡', title: 'Data-Driven Staffing Decision', desc: 'Analysis of hourly sales vs. shift costs showed overnight hours (~00:30–05:30) consistently failed to cover wages — especially weekends at 150%+ shift pay. The store sits in an industrial zone: traffic drops sharply after evening and surrounding businesses close on weekends. Recommended replacing 24/7 operation (three 8-hour shifts) with two shifts (05:00–15:00 / 15:00–00:00). Adopted as a 3-month trial in January 2026 and permanent since — night-shift and weekend premiums eliminated, fewer employees needed, less scheduling pressure.' },
            { icon: '📦', title: 'Inventory Optimization', desc: 'Identifying "dead stock" vs. high-velocity items to improve cash flow and reduce overstock.' },
            { icon: '⚡', title: 'Operational Clarity', desc: 'Reducing the time spent on manual reporting from hours to seconds — management gets weekly data-backed reports automatically.' },
            { icon: '✅', title: 'Data Integrity', desc: 'Automated dbt testing ensures that business decisions are never based on "dirty" or duplicated data.' },
            { icon: '💰', title: 'Zero Vendor Cost', desc: 'Completely eliminated the need for expensive Verifone reporting add-ons.' },
          ].map((item, i) => (
            <div key={i} className="cs-impact-card">
              <span className="cs-impact-icon">{item.icon}</span>
              <div>
                <h4 className="cs-impact-title">{item.title}</h4>
                <p className="cs-impact-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          TECH STACK
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Tech Stack</h2>
        <div className="tech-grid">
          {[
            { name: 'SQL', icon: '🗄️', desc: 'Query & transform relational data' },
            { name: 'dbt', icon: '🔧', desc: 'Modular data transformation' },
            { name: 'Supabase', icon: '⚡', desc: 'PostgreSQL data warehouse' },
            { name: 'Next.js', icon: '▲', desc: 'Frontend + API layer' },
            { name: 'Python', icon: '🐍', desc: 'EL scripts & data processing' },
            { name: 'Recharts', icon: '📊', desc: 'Interactive dashboard charting' },
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

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <div className="detail-actions" style={{ marginTop: '3rem' }}>
        <a href="https://github.com/tzafHavia/local_store_pipeline" target="_blank" rel="noopener noreferrer" className="btn-primary">
          View on GitHub ↗
        </a>
        <Link href="/projects" className="btn-ghost">← Back to Projects</Link>
      </div>

    </div>
  );
}
