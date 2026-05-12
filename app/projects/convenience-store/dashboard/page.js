import Link from 'next/link';
import KpiCard from '@/components/KpiCard';
import InventoryStatusDonut from '@/components/InventoryStatusDonut';
import OverviewDailyPerformanceTable from '@/components/OverviewDailyPerformanceTable';
import OverviewTopProductsChart from '@/components/OverviewTopProductsChart';
import OverviewTrendChart from '@/components/OverviewTrendChart';
import { fetchOverviewDashboardData } from '@/lib/pgClient';

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatCompactCurrency(value) {
  return `₪${new Intl.NumberFormat('he-IL', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0))}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const numericValue = Number(value);
  const sign = numericValue > 0 ? '+' : '';
  return `${sign}${numericValue.toFixed(1)}%`;
}

function formatPeriodLabel(start, end) {
  if (!start || !end) return 'Latest available period';
  const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });
  return `${formatter.format(new Date(`${start}T00:00:00`))} - ${formatter.format(new Date(`${end}T00:00:00`))}`;
}

function formatFreshness(value) {
  if (!value) return 'Freshness unavailable';
  return `Refreshed ${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))}`;
}

function getDeltaTone(delta) {
  if (delta == null || Math.abs(delta) < 0.1) return 'cyan';
  return delta > 0 ? 'green' : 'orange';
}

export default async function ConvenienceStoreDashboardPage() {
  let overview = null;

  try {
    overview = await fetchOverviewDashboardData();
  } catch (_) {
    overview = {
      freshness: null,
      latestSaleDate: null,
      currentPeriod: { start: null, end: null, days: 30 },
      previousPeriod: { start: null, end: null, days: 30 },
      kpis: {
        totalSales: 0,
        salesDeltaPct: null,
        totalTickets: 0,
        avgTicketAmount: 0,
        totalUnitsSold: 0,
        outOfStockCount: 0,
        stockoutRiskCount: 0,
        deadStockCount: 0,
      },
      dailySalesTrend: [],
      ticketTrend: [],
      topProducts: [],
      inventoryDistribution: [],
      recentDailyPerformance: [],
    };
  }

  const currentRangeLabel = formatPeriodLabel(
    overview.currentPeriod.start,
    overview.currentPeriod.end
  );
  const previousRangeLabel = formatPeriodLabel(
    overview.previousPeriod.start,
    overview.previousPeriod.end
  );

  const kpiCards = [
    {
      icon: '₪',
      label: 'Total sales',
      value: formatCurrency(overview.kpis.totalSales),
      sub: `Current 30 days · ${currentRangeLabel}`,
      color: 'green',
    },
    {
      icon: '↕',
      label: 'Vs previous period',
      value: formatPercent(overview.kpis.salesDeltaPct),
      sub: `Compared with ${previousRangeLabel}`,
      color: getDeltaTone(overview.kpis.salesDeltaPct),
    },
    {
      icon: '🧾',
      label: 'Total tickets',
      value: formatNumber(overview.kpis.totalTickets),
      sub: 'Current 30-day transaction volume',
      color: 'purple',
    },
    {
      icon: '🛒',
      label: 'Average ticket amount',
      value: formatCurrency(overview.kpis.avgTicketAmount),
      sub: 'Weighted by total sales and ticket count',
      color: 'cyan',
    },
    {
      icon: '📦',
      label: 'Total units sold',
      value: formatNumber(overview.kpis.totalUnitsSold),
      sub: 'Current 30-day volume',
      color: 'purple',
    },
    {
      icon: '⛔',
      label: 'Out-of-stock items',
      value: formatNumber(overview.kpis.outOfStockCount),
      sub: 'Latest inventory snapshot',
      color: 'orange',
    },
    {
      icon: '⚠',
      label: 'Stockout-risk items',
      value: formatNumber(overview.kpis.stockoutRiskCount),
      sub: 'Latest inventory snapshot',
      color: 'orange',
    },
    {
      icon: '◌',
      label: 'Dead stock items',
      value: formatNumber(overview.kpis.deadStockCount),
      sub: 'Latest inventory snapshot',
      color: 'cyan',
    },
  ];

  return (
    <div className="od-page">
      <Link href="/projects/convenience-store" className="back-link">
        ← Convenience Store Project
      </Link>

      <section className="od-hero">
        <div className="od-hero-copy">
          <div className="od-meta-row">
            <span className="detail-category">Dashboard</span>
            <span className="od-freshness-pill">{formatFreshness(overview.freshness)}</span>
          </div>
          <h1 className="od-title">Convenience Store Analytics Platform</h1>
          <p className="od-subtitle">
            Overview section for fast operational review across sales pace, ticket volume,
            product winners, and current inventory risk from the reporting layer.
          </p>
          <div className="od-action-row">
            <a href="#recent-performance" className="btn-primary">
              Jump to daily table
            </a>
            <Link href="/dbt-docs/index.html" className="btn-secondary" target="_blank">
              Open dbt docs ↗
            </Link>
          </div>
        </div>

        <div className="od-summary-card">
          <p className="od-summary-kicker">Current window</p>
          <p className="od-summary-range">{currentRangeLabel}</p>
          <div className="od-summary-stats">
            <div>
              <span>Total sales</span>
              <strong>{formatCompactCurrency(overview.kpis.totalSales)}</strong>
            </div>
            <div>
              <span>Tickets</span>
              <strong>{formatNumber(overview.kpis.totalTickets)}</strong>
            </div>
            <div>
              <span>Units sold</span>
              <strong>{formatNumber(overview.kpis.totalUnitsSold)}</strong>
            </div>
          </div>
          <p className="od-summary-note">
            Comparison baseline: {previousRangeLabel}
          </p>
        </div>
      </section>

      <section className="cs-section od-section-spacing">
        <div className="od-section-head">
          <div>
            <p className="od-section-kicker">Overview</p>
            <h2 className="cs-section-title">Operational snapshot</h2>
          </div>
          <div className="od-drill-links">
            <a href="#recent-performance" className="od-inline-link">
              View daily detail
            </a>
            <a href="#overview-top-products" className="od-inline-link">
              View product ranking
            </a>
            <a href="#inventory-mix" className="od-inline-link">
              View inventory mix
            </a>
          </div>
        </div>

        <div className="kpi-section od-kpi-grid">
          {kpiCards.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section className="od-two-col-grid od-section-spacing">
        <OverviewTrendChart
          title="Daily sales trend"
          description="Revenue by day across the latest 30-day operational window."
          data={overview.dailySalesTrend}
          dataKey="sales"
          lineColor="#6366f1"
          valueFormat="currency-compact"
          footerLink={{ href: '#recent-performance', label: 'View daily detail' }}
        />
        <OverviewTrendChart
          title="Ticket count trend"
          description="Daily transaction count to track basket frequency and footfall intensity."
          data={overview.ticketTrend}
          dataKey="tickets"
          lineColor="#22d3ee"
          valueFormat="number"
          footerLink={{ href: '#recent-performance', label: 'Inspect daily rows' }}
        />
      </section>

      <section className="od-two-col-grid od-section-spacing">
        <OverviewTopProductsChart
          data={overview.topProducts}
          footerLink={{ href: '#overview-top-products', label: 'Top 10 live ranking' }}
        />
        <InventoryStatusDonut
          data={overview.inventoryDistribution}
          footerLink={{ href: '#inventory-mix', label: 'Latest inventory split' }}
        />
      </section>

      <section className="od-panel od-section-spacing" id="recent-performance">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Detail table</p>
            <h3>Recent daily performance summary</h3>
          </div>
          <span className="od-faint-note">Sortable columns</span>
        </div>
        <p className="od-panel-copy">
          Recent daily summary rows, sorted by newest date by default and available
          for quick comparison across revenue, units, tickets, and average basket value.
        </p>
        <OverviewDailyPerformanceTable rows={overview.recentDailyPerformance} />
      </section>
    </div>
  );
}