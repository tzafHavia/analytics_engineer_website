import Link from 'next/link';
import OverviewFilters from '@/components/OverviewFilters';
import InventoryStatusDonut from '@/components/InventoryStatusDonut';
import OverviewDailyPerformanceTable from '@/components/OverviewDailyPerformanceTable';
import OverviewTopProductsChart from '@/components/OverviewTopProductsChart';
import OverviewTrendChart from '@/components/OverviewTrendChart';
import { fetchOverviewDashboardData, fetchOverviewFilterOptions } from '@/lib/dashboardData';

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

function DashKpiCard({ label, value, sub, color = 'cyan', trend }) {
  const toneClass =
    trend > 0.05 ? 'dash-kpi-trend-up' :
    trend < -0.05 ? 'dash-kpi-trend-down' : 'dash-kpi-trend-flat';
  const arrow = trend > 0.05 ? '▲' : trend < -0.05 ? '▼' : '–';
  return (
    <div className={`dash-kpi-card dash-kpi-${color}`}>
      <p className="dash-kpi-label">{label}</p>
      <p className="dash-kpi-value">{value}</p>
      {sub && <p className="dash-kpi-sub">{sub}</p>}
      {trend != null && !Number.isNaN(trend) && (
        <p className={`dash-kpi-trend ${toneClass}`}>
          {arrow} {Math.abs(trend).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

function getSearchParamValue(value) {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

function getActiveFilterChips(filters) {
  const chips = [];

  if (filters.dateFrom || filters.dateTo) {
    const start = filters.dateFrom || 'Start';
    const end = filters.dateTo || 'Latest';
    chips.push({ key: 'date', label: `Date: ${start} to ${end}` });
  }

  if (filters.productCategory) {
    chips.push({ key: 'productCategory', label: `Category: ${filters.productCategory}` });
  }

  if (filters.itemName) {
    chips.push({ key: 'itemName', label: `Item: ${filters.itemName}` });
  }

  if (filters.stockStatus) {
    chips.push({ key: 'stockStatus', label: `Stock: ${filters.stockStatus}` });
  }

  if (filters.velocityBand) {
    chips.push({ key: 'velocityBand', label: `Velocity: ${filters.velocityBand}` });
  }

  return chips;
}

export default async function ConvenienceStoreDashboardPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const filters = {
    dateFrom: getSearchParamValue(resolvedSearchParams?.dateFrom),
    dateTo: getSearchParamValue(resolvedSearchParams?.dateTo),
    productCategory: getSearchParamValue(resolvedSearchParams?.productCategory),
    itemName: getSearchParamValue(resolvedSearchParams?.itemName),
    stockStatus: getSearchParamValue(resolvedSearchParams?.stockStatus),
    velocityBand: getSearchParamValue(resolvedSearchParams?.velocityBand),
  };

  let overview = null;
  let filterOptions = {
    productCategories: [],
    itemNames: [],
    stockStatuses: [],
    velocityBands: [],
  };

  try {
    [overview, filterOptions] = await Promise.all([
      fetchOverviewDashboardData(filters),
      fetchOverviewFilterOptions(),
    ]);
  } catch (_) {
    overview = {
      freshness: null,
      latestSaleDate: null,
      currentPeriod: { start: null, end: null, days: 30 },
      previousPeriod: { start: null, end: null, days: 30 },
      activeFilters: filters,
      kpis: {
        totalSales: 0,
        salesDeltaPct: null,
        totalTickets: 0,
        avgTicketAmount: 0,
        totalUnitsSold: 0,
        outOfStockCount: 0,
        stockoutRiskCount: 0,
        avgDaysOfCover: null,
      },
      dailySalesTrend: [],
      ticketTrend: [],
      topProducts: [],
      topProductsMetric: {
        key: 'salesAmount30d',
        label: 'Revenue',
        heading: 'Top 10 products by sales',
        description: 'Revenue leaders ordered by rolling 30-day sales amount.',
        valueFormat: 'currency-compact',
      },
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
  const activeFilterChips = getActiveFilterChips(overview.activeFilters || filters);

  const noDataMsg = overview.latestSaleDate
    ? `No data for this period. Latest available date: ${overview.latestSaleDate}.`
    : 'No data available.';

  const kpiCards = [
    {
      icon: '₪',
      label: 'Total sales',
      value: formatCurrency(overview.kpis.totalSales),
      sub: currentRangeLabel,
      color: 'green',
    },
    {
      icon: '↕',
      label: 'Vs previous period',
      value: formatPercent(overview.kpis.salesDeltaPct),
      sub: `Compared with ${previousRangeLabel}`,
      color: getDeltaTone(overview.kpis.salesDeltaPct),
      trend: overview.kpis.salesDeltaPct,
    },
    {
      icon: '🧾',
      label: 'Total tickets',
      value: formatNumber(overview.kpis.totalTickets),
      sub: currentRangeLabel,
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
      sub: currentRangeLabel,
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
      icon: '📊',
      label: 'Avg days of cover',
      value: overview.kpis.avgDaysOfCover != null
        ? `${Number(overview.kpis.avgDaysOfCover).toFixed(1)}d`
        : '—',
      sub: 'Avg stock coverage across SKUs (30d)',
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

      <OverviewFilters initialFilters={overview.activeFilters || filters} options={filterOptions} />

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

        <div className="dash-kpi-dark-grid">
          {kpiCards.map((card) => (
            <DashKpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              sub={card.sub}
              color={card.color}
              trend={card.trend}
            />
          ))}
        </div>
        {overview.kpis.totalSales === 0 && overview.kpis.totalTickets === 0 && (
          <p className="od-no-data-notice">
            ⚠ No sales data found for <strong>{currentRangeLabel}</strong>.
            {overview.latestSaleDate && (
              <> Latest available date: <strong>{overview.latestSaleDate}</strong>.</>
            )}
          </p>
        )}
      </section>

      {activeFilterChips.length ? (
        <section className="od-active-filters" aria-label="Active filters">
          <div className="od-active-filters-head">
            <span className="od-panel-kicker">Active filters</span>
            <Link href="/projects/convenience-store/dashboard" className="od-inline-link">
              Clear all
            </Link>
          </div>
          <div className="od-chip-row">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className="od-filter-chip">
                {chip.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="od-two-col-grid od-section-spacing">
        <OverviewTrendChart
          title="Daily sales trend"
          description={`Revenue by day · ${currentRangeLabel}`}
          data={overview.dailySalesTrend}
          dataKey="sales"
          lineColor="#6366f1"
          valueFormat="currency-compact"
          footerLink={{ href: '#recent-performance', label: 'View daily detail' }}
          secondaryLines={[
            { dataKey: 'avg7d', name: '7-day avg', color: '#94a3b8', dashed: true },
          ]}
          noDataMessage={noDataMsg}
        />
        <OverviewTrendChart
          title="Ticket count trend"
          description={`Daily transaction count · ${currentRangeLabel}`}
          data={overview.ticketTrend}
          dataKey="tickets"
          lineColor="#22d3ee"
          valueFormat="number"
          footerLink={{ href: '#recent-performance', label: 'Inspect daily rows' }}
          noDataMessage={noDataMsg}
        />
      </section>

      <section className="od-two-col-grid od-section-spacing">
        <OverviewTopProductsChart
          data={overview.topProducts}
          metric={overview.topProductsMetric}
          footerLink={{ href: '#overview-top-products', label: 'Top 10 live ranking' }}
        />
        <InventoryStatusDonut
          data={overview.inventoryDistribution}
          snapshotDate={overview.inventoryDistribution[0]?.snapshotDate ?? null}
          footerLink={{ href: '#inventory-mix', label: 'Latest inventory split' }}
        />
      </section>

      <section className="od-panel od-section-spacing" id="recent-performance">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Detail table · {currentRangeLabel}</p>
            <h3>Daily performance summary</h3>
          </div>
          <span className="od-faint-note">Sortable columns</span>
        </div>
        <p className="od-panel-copy">
          All days in the selected period, sorted newest first. Adjust the date filter above to change the range.
        </p>
        <OverviewDailyPerformanceTable rows={overview.recentDailyPerformance} />
      </section>
    </div>
  );
}