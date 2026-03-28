import Image from 'next/image';
import Link from 'next/link';
import { fetchDailySales, fetchPaymentKpiComparison } from '@/lib/pgClient';
import DailySalesChart from '@/components/DailySalesChart';
import RadialGaugeKpiCard from '@/components/RadialGaugeKpiCard';

const KPI_TARGETS = {
  total_revenue: {
    target: 320000,
    format: 'currency',
    higherIsBetter: true,
    label: 'Monthly target',
  },
  avg_basket_size: {
    target: 92,
    format: 'currency',
    higherIsBetter: true,
    label: 'Basket target',
  },
  avg_daily_revenue: {
    target: 11500,
    format: 'currency',
    higherIsBetter: true,
    label: 'Daily run-rate target',
  },
  credit_rate: {
    target: 58,
    format: 'pct',
    higherIsBetter: true,
    label: 'Payment mix target',
  },
};

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getComparisonPeriods(referenceDate = new Date()) {
  const currentStart = startOfMonth(referenceDate);
  const currentEnd = addDays(referenceDate, 1);
  const currentSpanDays = Math.max(
    1,
    Math.round((currentEnd.getTime() - currentStart.getTime()) / 86400000)
  );
  const previousStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const previousMonthEnd = currentStart;
  const previousEndCandidate = addDays(previousStart, currentSpanDays);
  const previousEnd =
    previousEndCandidate.getTime() > previousMonthEnd.getTime()
      ? previousMonthEnd
      : previousEndCandidate;

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

function formatDateRange(start, endExclusive) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const inclusiveEnd = addDays(endExclusive, -1);
  return `${formatter.format(start)} - ${formatter.format(inclusiveEnd)}`;
}

function formatMetric(value, type = 'currency') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  if (type === 'currency') {
    return `₪${Number(value).toLocaleString('he-IL', { minimumFractionDigits: 0 })}`;
  }
  if (type === 'pct') {
    return `${Number(value).toFixed(1)}%`;
  }
  return Number(value).toLocaleString('he-IL');
}

function formatCompactMetric(value, type = 'currency') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  if (type === 'currency') {
    return `₪${new Intl.NumberFormat('he-IL', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(value))}`;
  }
  if (type === 'pct') {
    return `${Number(value).toFixed(0)}%`;
  }
  return new Intl.NumberFormat('he-IL', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function formatDelta(value, type = 'pct') {
  if (value == null || Number.isNaN(Number(value))) return null;
  const numericValue = Number(value);
  const sign = numericValue > 0 ? '+' : '';

  if (type === 'pct') {
    return `${sign}${numericValue.toFixed(1)}%`;
  }

  return `${sign}${formatMetric(numericValue, type)}`;
}

function getDelta(currentValue, previousValue) {
  if (
    currentValue == null ||
    previousValue == null ||
    Number(previousValue) === 0 ||
    Number.isNaN(Number(currentValue)) ||
    Number.isNaN(Number(previousValue))
  ) {
    return null;
  }

  return ((Number(currentValue) - Number(previousValue)) / Math.abs(Number(previousValue))) * 100;
}

function getTrendTone(delta, higherIsBetter = true) {
  if (delta == null) return 'flat';
  if (Math.abs(delta) < 0.3) return 'flat';
  const improving = higherIsBetter ? delta > 0 : delta < 0;
  return improving ? 'positive' : 'negative';
}

function roundUpNiceNumber(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 1.5) return 1.5 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getGaugeMaxValue(currentValue, previousValue, targetValue, format) {
  if (format === 'pct') {
    return 100;
  }

  const safeCurrent = Number(currentValue) || 0;
  const safePrevious = Number(previousValue) || 0;
  const safeTarget = Number(targetValue) || 0;
  const baseline = Math.max(safeCurrent, safePrevious, safeTarget, 1);
  return roundUpNiceNumber(Math.max(safeTarget * 1.2, baseline * 1.08));
}

function buildGaugeMetricModel({
  metricKey,
  icon,
  label,
  color,
  format,
  current,
  previous,
  timeframe,
  comparisonTimeframe,
}) {
  const currentSnapshot = current ?? {};
  const previousSnapshot = previous ?? {};
  const targetConfig = KPI_TARGETS[metricKey];
  const currentValue = currentSnapshot[metricKey] ?? null;
  const previousValue = previousSnapshot[metricKey] ?? null;
  const delta = getDelta(currentValue, previousValue);
  const targetValue = targetConfig?.target ?? null;
  const maxValue = getGaugeMaxValue(currentValue, previousValue, targetValue, format);
  const trendTone = getTrendTone(delta, targetConfig?.higherIsBetter);

  return {
    icon,
    label,
    color,
    displayValue: formatMetric(currentValue, format),
    displayPrevious: formatCompactMetric(previousValue, format),
    displayTarget: formatCompactMetric(targetValue, format),
    timeframe,
    deltaLabel: delta == null ? '—' : formatDelta(delta),
    deltaTone: trendTone,
    currentValue: currentValue == null ? 0 : Number(currentValue),
    previousValue: previousValue == null ? 0 : Number(previousValue),
    targetValue: targetValue == null ? 0 : Number(targetValue),
    maxValue,
    scaleMinLabel: format === 'pct' ? '0%' : '0',
    scaleMaxLabel: formatCompactMetric(maxValue, format),
    ariaLabel:
      delta == null
        ? `${label}. Current value ${formatMetric(currentValue, format)}. Target ${formatMetric(targetValue, format)}.`
        : `${label}. Current value ${formatMetric(currentValue, format)}, previous period ${formatMetric(previousValue, format)}, target ${formatMetric(targetValue, format)}, change ${formatDelta(delta)} versus ${comparisonTimeframe}.`,
  };
}

// ─── Static chart placeholder ───────────────────────────────────────────────
function ChartPlaceholder({ title, description, type = 'bar', height = 240 }) {
  const bars =
    type === 'bar'
      ? [65, 82, 55, 90, 70, 78, 60, 95, 72, 85]
      : type === 'line'
      ? [40, 65, 50, 80, 60, 75, 55, 90, 70, 85]
      : null;

  return (
    <div className="chart-placeholder">
      <div className="chart-ph-header">
        <span className="chart-ph-title">{title}</span>
        <span className="chart-ph-badge">Live data coming soon</span>
      </div>
      <p className="chart-ph-desc">{description}</p>

      <div className="chart-ph-frame" style={{ height }}>
        {/* Y-axis labels */}
        <div className="chart-ph-y-axis">
          {['100', '75', '50', '25', '0'].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="chart-ph-area">
          {/* Grid lines */}
          <div className="chart-ph-grid">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="chart-ph-grid-line" />
            ))}
          </div>

          {type === 'bar' && (
            <div className="chart-ph-bars">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="chart-ph-bar"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${i * 80}ms`,
                    background: `linear-gradient(to top, #6366f1, #22d3ee)`,
                    opacity: 0.6 + i * 0.03,
                  }}
                />
              ))}
            </div>
          )}

          {type === 'line' && (
            <svg
              className="chart-ph-svg"
              viewBox="0 0 220 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`lg-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,60 L22,35 L44,50 L66,20 L88,40 L110,25 L132,45 L154,10 L176,30 L198,15 L220,5"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
              />
              <path
                d="M0,60 L22,35 L44,50 L66,20 L88,40 L110,25 L132,45 L154,10 L176,30 L198,15 L220,5 L220,100 L0,100 Z"
                fill={`url(#lg-${title})`}
              />
            </svg>
          )}

          {type === 'hbar' && (
            <div className="chart-ph-hbars">
              {['Top Product', 'Category A', 'Category B', 'Category C', 'Other'].map(
                (label, i) => (
                  <div key={i} className="chart-ph-hbar-row">
                    <span className="chart-ph-hbar-label">{label}</span>
                    <div className="chart-ph-hbar-track">
                      <div
                        className="chart-ph-hbar-fill"
                        style={{ width: `${80 - i * 13}%` }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {type === 'pie' && (
            <div className="chart-ph-pie">
              <svg viewBox="0 0 100 100" width="160" height="160">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#6366f1" strokeWidth="18" strokeDasharray="150 251" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#22d3ee" strokeWidth="18" strokeDasharray="60 251" strokeDashoffset="-150" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#4ade80" strokeWidth="18" strokeDasharray="41 251" strokeDashoffset="-210" />
              </svg>
              <div className="chart-ph-pie-legend">
                {['Sales', 'Costs', 'Profit'].map((l, i) => (
                  <div key={i} className="chart-ph-legend-item">
                    <span className={`chart-ph-legend-dot cs-dot-${i}`} />
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* X-axis labels */}
      {(type === 'bar' || type === 'line') && (
        <div className="chart-ph-x-axis">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map(
            (d) => (
              <span key={d}>{d}</span>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Metric KPI card ─────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color }) {
  return (
    <div className={`cs-metric-card cs-metric-${color}`}>
      <span className="cs-metric-icon">{icon}</span>
      <p className="cs-metric-label">{label}</p>
      <p className="cs-metric-value">{value}</p>
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
  title: 'Convenience Store Analytics | DataPortfolio',
  description:
    'End-to-end data platform transforming POS data into actionable business insights.',
};

export default async function ConvenienceStorePage() {
  const periods = getComparisonPeriods();
  const currentRange = formatDateRange(periods.currentStart, periods.currentEnd);
  const previousRange = formatDateRange(periods.previousStart, periods.previousEnd);

  let kpis = null;
  let dailySales = [];
  try {
    [kpis, dailySales] = await Promise.all([
      fetchPaymentKpiComparison({
        currentStart: toIsoDate(periods.currentStart),
        currentEnd: toIsoDate(periods.currentEnd),
        previousStart: toIsoDate(periods.previousStart),
        previousEnd: toIsoDate(periods.previousEnd),
      }),
      fetchDailySales(),
    ]);
  } catch (_) {
    // DB unavailable — render with fallback values
    kpis = {
      current: null,
      previous: null,
    };
  }

  const liveMetricCards = [
    buildGaugeMetricModel({
      metricKey: 'total_revenue',
      icon: '💰',
      label: 'Total Revenue',
      color: 'green',
      format: 'currency',
      current: kpis?.current,
      previous: kpis?.previous,
      timeframe: `This month · ${currentRange}`,
      comparisonTimeframe: previousRange,
    }),
    buildGaugeMetricModel({
      metricKey: 'avg_basket_size',
      icon: '🛒',
      label: 'Avg. Basket Size',
      color: 'purple',
      format: 'currency',
      current: kpis?.current,
      previous: kpis?.previous,
      timeframe: `This month · ${currentRange}`,
      comparisonTimeframe: previousRange,
    }),
    buildGaugeMetricModel({
      metricKey: 'avg_daily_revenue',
      icon: '📅',
      label: 'Avg. Daily Revenue',
      color: 'cyan',
      format: 'currency',
      current: kpis?.current,
      previous: kpis?.previous,
      timeframe: `MTD run-rate · ${currentRange}`,
      comparisonTimeframe: previousRange,
    }),
    buildGaugeMetricModel({
      metricKey: 'credit_rate',
      icon: '💳',
      label: 'Credit Card Rate',
      color: 'orange',
      format: 'pct',
      current: kpis?.current,
      previous: kpis?.previous,
      timeframe: `This month · ${currentRange}`,
      comparisonTimeframe: previousRange,
    }),
  ];

  return (
    <div className="cs-page">

      {/* ── Back ─────────────────────────────────────────────────────── */}
      <Link href="/projects" className="back-link">← All Projects</Link>

      {/* ══════════════════════════════════════════════════════════════
          LIVE KPIs — server-side aggregates from shlomy_store.payments_complete
          Produced by dbt model: stg_fact_sales_p (local_store_pipeline repo)
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <div className="cs-section-eyebrow">
          <span className="live-dot" />
          <span className="live-label">Live Data</span>
          <span className="live-source">
            Source: <code>shlomy_store.payments_complete</code> · dbt model{' '}
            <a
              href="https://github.com/HomeDigSoftware/local_store_pipeline/blob/main/models/stg/stg_fact_sales_p.sql"
              target="_blank"
              rel="noopener noreferrer"
              className="live-source-link"
            >
              stg_fact_sales_p
            </a>
          </span>
        </div>
        <h2 className="cs-section-title">Pipeline KPIs</h2>
        <p className="cs-section-subtitle">
          Real aggregates computed server-side from the production database. Each gauge
          shows the current month-to-date value, a lighter band for the same days last month,
          and a target marker anchored to the same scale.
        </p>
        <div className="kpi-section cs-gauge-grid">
          {liveMetricCards.map((card) => (
            <RadialGaugeKpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-hero">
        <div className="cs-hero-inner">
          <div className="cs-hero-eyebrow">
            <span className="eyebrow-dot" />
            Data Engineering · Analytics · Business Intelligence
          </div>
          <h1 className="cs-hero-title">
            Convenience Store
            <span className="hero-highlight"> Analytics Platform</span>
          </h1>
          <p className="cs-hero-subtitle">
            A complete end-to-end data pipeline that transforms raw POS transactions
            into actionable dashboards, automated reports, and financial insights — all
            at zero vendor cost.
          </p>

          {/* Tech badges */}
          <div className="card-tech-stack cs-hero-tech">
            {['SQL', 'dbt', 'Supabase', 'Next.js', 'Python', 'Power BI'].map((t) => (
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
            <a
              href="https://github.com/HomeDigSoftware/local_store_pipeline"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
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
            <span className="btn-outline" style={{ cursor: 'default', opacity: 0.5 }}>
              Live Dashboard (coming soon)
            </span>
          </div>
        </div>

        {/* Status + scope badges */}
        <div className="cs-hero-badges">
          <span className="card-status card-status-live">● Live Project</span>
          <span className="cs-scope-badge">🏪 Retail</span>
          <span className="cs-scope-badge">📊 BI</span>
          <span className="cs-scope-badge">🔄 ETL</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          ARCHITECTURE DIAGRAM
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Data Architecture</h2>
        <p className="cs-section-subtitle">
          Raw POS data flows through a nightly ETL job into dbt transformations, lands
          in Supabase, and surfaces through a Next.js API to interactive dashboards and
          BI tools.
        </p>

        {/* Pipeline pills */}
        <div className="cs-pipeline">
          <PipelineStep icon="🖥️" title="POS System" desc="Verifone – nightly export at 01:30 AM" color="blue" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="🔧" title="dbt Models" desc="Staging · Marts · Metrics" color="orange" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="⚡" title="Supabase" desc="PostgreSQL data warehouse" color="green" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="▲" title="Next.js API" desc="Controlled data access layer" color="purple" />
          <span className="cs-pipe-arrow">→</span>
          <PipelineStep icon="📊" title="Dashboards" desc="Power BI · Tableau · Custom UI" color="cyan" />
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
            Fig 1. End-to-End Data Pipeline Architecture — POS → dbt → Supabase → API → BI
          </p>
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
          The client defined three types of recurring business reports.
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
          I built a robust, scalable data pipeline designed to transform raw operational
          data into actionable business intelligence. By leveraging the Modern Data Stack,
          this project automates the journey from cloud storage to a high-level executive
          dashboard.
        </p>
        <div className="cs-solution-grid">
          {[
            { icon: '🔄', title: 'Automated Ingestion', desc: 'Nightly ETL job extracts POS backups at 01:30 AM and loads raw data into the local database.' },
            { icon: '🔧', title: 'dbt Transformations', desc: 'Staging models clean and normalize raw data. Mart models build fact and dimension tables. Metric models compute business KPIs.' },
            { icon: '⚡', title: 'Supabase Warehouse', desc: 'Transformed data is stored in a structured PostgreSQL database on Supabase, ready for fast querying.' },
            { icon: '▲', title: 'Next.js API Layer', desc: 'A controlled API layer exposes the data to the dashboard UI, with filtering and pagination built in.' },
            { icon: '📊', title: 'Interactive Dashboards', desc: 'Business users can view sales trends, employee stats, inventory snapshots, and weekly summaries in real time.' },
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
                Created an interactive <strong>Tableau dashboard</strong> that translates
                raw numbers into a visual story, allowing stakeholders to drill down from
                high-level KPIs to specific product performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          KEY DASHBOARDS  (chart placeholders)
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Key Dashboards</h2>
        <p className="cs-section-subtitle">
          Four dashboard views are planned. Chart areas will populate from live Supabase
          data once the pipeline is connected.
        </p>

        <div className="cs-dashboards-grid">

          {/* Dashboard 1 — Sales (Live) */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>🏪</span> Sales Performance Dashboard
            </div>
            <p className="cs-db-desc">
              Daily revenue totals computed from <code>shlomy_store.payments_complete</code> —
              each bar represents one trading day.
            </p>
            <DailySalesChart data={dailySales} />
          </div>

          {/* Dashboard 2 — Employee */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>👥</span> Employee Analytics Dashboard
            </div>
            <p className="cs-db-desc">
              Total hours per employee, salary estimation, and productivity (sales per
              hour worked).
            </p>
            <ChartPlaceholder
              title="Hours Worked per Employee"
              description="Horizontal bar showing employee hour distribution"
              type="hbar"
              height={220}
            />
          </div>

          {/* Dashboard 3 — Inventory */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>📦</span> Inventory Insights Dashboard
            </div>
            <p className="cs-db-desc">
              Stock levels, fast vs slow moving products, and inventory turnover rate.
            </p>
            <ChartPlaceholder
              title="Category Revenue Contribution"
              description="Pie chart showing contribution by product category"
              type="pie"
              height={220}
            />
          </div>

          {/* Dashboard 4 — Weekly Summary */}
          <div className="cs-dashboard-block">
            <div className="cs-db-label">
              <span>📅</span> Weekly Summary Dashboard
            </div>
            <p className="cs-db-desc">
              Daily breakdown of revenue, costs, and profit. Top 10 products per day
              every Sunday.
            </p>
            <ChartPlaceholder
              title="Profit Trend (last 7 days)"
              description="Line chart showing daily profit over the past week"
              type="line"
              height={220}
            />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          ADVANCED METRICS  (placeholder values)
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Advanced Metrics & KPIs</h2>
        <p className="cs-section-subtitle">
          Beyond the base requirements — deeper KPIs implemented to surface more business
          value.
        </p>

        {/* Financial */}
        <h3 className="cs-metrics-group-title">💰 Financial</h3>
        <div className="kpi-section cs-metrics-row">
          <MetricCard icon="🛒" label="Avg. Basket Size" value="—" sub="Per transaction" color="purple" />
          <MetricCard icon="⏱️" label="Revenue / Hour" value="—" sub="Operating hours" color="cyan" />
          <MetricCard icon="📊" label="Profit Margin" value="—" sub="Gross %" color="green" />
          <MetricCard icon="💳" label="Daily Revenue" value="—" sub="Average" color="orange" />
        </div>

        {/* Product */}
        <h3 className="cs-metrics-group-title" style={{ marginTop: '2rem' }}>🛒 Product Analytics</h3>
        <div className="kpi-section cs-metrics-row">
          <MetricCard icon="🏆" label="Top SKU" value="—" sub="By revenue" color="purple" />
          <MetricCard icon="📉" label="Low Performers" value="—" sub="Items to review" color="orange" />
          <MetricCard icon="🗂️" label="Top Category" value="—" sub="Revenue share" color="cyan" />
          <MetricCard icon="🔄" label="Turnover Rate" value="—" sub="Inventory cycles" color="green" />
        </div>

        {/* Time */}
        <h3 className="cs-metrics-group-title" style={{ marginTop: '2rem' }}>⏰ Time-Based Insights</h3>
        <div className="kpi-section cs-metrics-row">
          <MetricCard icon="📈" label="Peak Hour" value="—" sub="Highest traffic" color="cyan" />
          <MetricCard icon="📅" label="Peak Day" value="—" sub="Best sales day" color="green" />
          <MetricCard icon="🌙" label="Evening Share" value="—" sub="% of daily revenue" color="purple" />
          <MetricCard icon="📆" label="Best Week" value="—" sub="Month-to-date" color="orange" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          KEY INSIGHTS
      ══════════════════════════════════════════════════════════════ */}
      <section className="cs-section">
        <h2 className="cs-section-title">Key Insights</h2>
        <div className="insights-list">
          {[
            'A small number of products generated a large portion of total revenue (Pareto principle confirmed)',
            'Peak sales hours consistently occurred in the evening, across all days of the week',
            'Some high-cost products had low sales volume, significantly reducing overall profitability',
            'Employee productivity varied significantly between shifts and individuals',
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
            { icon: '�', title: 'Inventory Optimization', desc: 'Identifying "dead stock" vs. high-velocity items to improve cash flow and reduce overstock.' },
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
            { name: 'Python', icon: '🐍', desc: 'ETL scripts & data processing' },
            { name: 'Power BI', icon: '📊', desc: 'Visualization & BI reports' },
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
        <a href="https://github.com/HomeDigSoftware/local_store_pipeline" target="_blank" rel="noopener noreferrer" className="btn-primary">
          View on GitHub ↗
        </a>
        <Link href="/projects" className="btn-ghost">← Back to Projects</Link>
      </div>

    </div>
  );
}
