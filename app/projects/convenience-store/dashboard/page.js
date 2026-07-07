import { Suspense } from 'react';
import Link from 'next/link';
import OverviewFilters from '@/components/OverviewFilters';
import InventoryStatusDonut from '@/components/InventoryStatusDonut';
import OverviewDailyPerformanceTable from '@/components/OverviewDailyPerformanceTable';
import OverviewTopProductsChart from '@/components/OverviewTopProductsChart';
import OverviewTrendChart from '@/components/OverviewTrendChart';
import DashboardTabNav from '@/components/DashboardTabNav';
import InventoryTabContent from '@/components/InventoryTabContent';
import SalesTabContent from '@/components/SalesTabContent';
import WorkforceTabContent from '@/components/WorkforceTabContent';
import ProductsTabContent from '@/components/ProductsTabContent';
import { fetchOverviewDashboardData, fetchOverviewFilterOptions, fetchInventoryDashboardData, fetchSalesDashboardData, fetchProductsDashboardData, fetchWorkforceDashboardData, fetchWorstOffendersData } from '@/lib/dashboardData';

// ─── Format helpers ───────────────────────────────────────────────────────────

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

// ─── KPI card component ───────────────────────────────────────────────────────

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

// ─── Tab placeholder (shown while a tab is not yet built) ─────────────────────

const TAB_PREVIEWS = {
  sales: {
    emoji: '📈',
    title: 'Sales',
    description:
      'Detailed breakdown of daily revenue, ticket trends, payment mix, and returns — all filterable by date range and category.',
    features: [
      '6 KPI cards: net sales, units sold, ticket count, avg ticket, return rate, credit share',
      'Daily sales trend + 7-day moving average overlay',
      'Average ticket trend over time',
      'Sales by category and by hour of day',
      'Payment method distribution (cash / credit / other)',
      'Returns breakdown by product and date',
    ],
    tables: ['rpt_daily_sales', 'rpt_sales_trend_daily', 'rpt_payment_mix_daily', 'rpt_returns_analysis_daily', 'rpt_sales_by_hour'],
  },
  inventory: {
    emoji: '📦',
    title: 'Inventory',
    description:
      'Actionable inventory intelligence — reorder alerts, overstock reviews, and dead stock lists based on the latest snapshot.',
    features: [
      '6 KPI cards: total items, out-of-stock, stockout-risk, overstock, dead stock, avg days of cover',
      'Stock status distribution donut chart',
      'Days-of-cover histogram (bucketed: 0–7d, 7–14d, 14–30d, 30d+)',
      'At-risk items grouped by product category',
      'Inventory vs sold-quantity scatter plot (30d)',
      'Action tables: Reorder Now · Overstock Review · Dead Stock List',
    ],
    tables: ['rpt_inventory_risk', 'rpt_product_velocity', 'rpt_inventory_actions'],
    disclaimer:
      'Inventory coverage metrics are based on the recent 30-day sales pace.',
  },
  products: {
    emoji: '🏷️',
    title: 'Products & Categories',
    description:
      'Revenue drivers, slow movers, and category-level profit analysis to guide purchasing and ranging decisions.',
    features: [
      '5 KPI cards: top product by sales, top by units, slowest count, top category revenue & GP estimate',
      'Top 10 products by revenue (bar chart)',
      'Bottom 10 products by velocity (slowest movers)',
      'Category revenue treemap',
      'Sales vs gross profit estimate scatter plot by product',
      'Full sortable product and category ranking tables',
    ],
    tables: ['rpt_product_performance_30d', 'rpt_category_performance_30d', 'rpt_product_velocity'],
  },
  workforce: {
    emoji: '👥',
    title: 'Workforce',
    description:
      'Staffing hours and hour-share sales attribution per employee — helping identify scheduling opportunities.',
    features: [
      '5 KPI cards: total hours worked, avg sales/hour, highest & lowest productivity employee, total attributed sales',
      'Sales per hour by employee (bar chart)',
      'Employee productivity trend over time (line chart)',
      'Hours worked vs attributed sales scatter plot',
      'Shift count by employee (bar chart)',
      'Daily and aggregated employee productivity tables',
    ],
    tables: ['rpt_employee_productivity', 'rpt_workforce_productivity_summary'],
    disclaimer:
      'Employee sales values are estimated using worked-hour share — not direct transaction ownership.',
  },
};

function DashTabPlaceholder({ tabKey }) {
  const preview = TAB_PREVIEWS[tabKey];
  if (!preview) return null;
  return (
    <div className="dash-tab-placeholder">
      <span className="dash-tab-placeholder-emoji">{preview.emoji}</span>
      <h2>{preview.title}</h2>
      <p className="dash-tab-placeholder-desc">{preview.description}</p>
      <ul className="dash-tab-placeholder-features">
        {preview.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="dash-tab-placeholder-tables">
        {preview.tables.map((t) => (
          <span key={t} className="dash-tab-placeholder-table-chip">{t}</span>
        ))}
      </div>
      {preview.disclaimer && (
        <p className="dash-tab-placeholder-disclaimer">⚠ {preview.disclaimer}</p>
      )}
    </div>
  );
}

// ─── Param helpers ────────────────────────────────────────────────────────────

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
  if (filters.productCategory) chips.push({ key: 'productCategory', label: `Category: ${filters.productCategory}` });
  if (filters.itemName) chips.push({ key: 'itemName', label: `Item: ${filters.itemName}` });
  if (filters.stockStatus) chips.push({ key: 'stockStatus', label: `Stock: ${filters.stockStatus}` });
  if (filters.velocityBand) chips.push({ key: 'velocityBand', label: `Velocity: ${filters.velocityBand}` });
  return chips;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConvenienceStoreDashboardPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;

  const tab = getSearchParamValue(resolvedSearchParams?.tab) || 'overview';
  const isOverview = tab === 'overview';

  const filters = {
    dateFrom:        getSearchParamValue(resolvedSearchParams?.dateFrom),
    dateTo:          getSearchParamValue(resolvedSearchParams?.dateTo),
    productCategory: getSearchParamValue(resolvedSearchParams?.productCategory),
    itemName:        getSearchParamValue(resolvedSearchParams?.itemName),
    stockStatus:     getSearchParamValue(resolvedSearchParams?.stockStatus),
    velocityBand:    getSearchParamValue(resolvedSearchParams?.velocityBand),
  };

  // Fetch data only for the active tab
  let overview = null;
  let inventoryData = null;
  let worstOffenders = [];
  let salesData = null;
  let productsData = null;
  let workforceData = null;
  let filterOptions = { productCategories: [], itemNames: [], stockStatuses: [], velocityBands: [] };

  if (isOverview) {
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
          totalSales: 0, salesDeltaPct: null, totalTickets: 0,
          avgTicketAmount: 0, totalUnitsSold: 0,
          outOfStockCount: 0, stockoutRiskCount: 0, deadStockCount: 0, avgDaysOfCover: null,
        },
        dailySalesTrend: [],
        ticketTrend: [],
        topProducts: [],
        topProductsMetric: {
          key: 'salesAmount30d', label: 'Revenue',
          heading: 'Top 10 products by sales',
          description: 'Revenue leaders ordered by rolling 30-day sales amount.',
          valueFormat: 'currency-compact',
        },
        inventoryDistribution: [],
        recentDailyPerformance: [],
      };
    }
  } else if (tab === 'sales') {
    try {
      [salesData, filterOptions] = await Promise.all([
        fetchSalesDashboardData(filters),
        fetchOverviewFilterOptions(),
      ]);
    } catch (_) {}
  } else if (tab === 'products') {
    try {
      [productsData, filterOptions] = await Promise.all([
        fetchProductsDashboardData(filters),
        fetchOverviewFilterOptions(),
      ]);
    } catch (_) {}
  } else if (tab === 'inventory') {
    try {
      let worstOffendersResult = { items: [] };
      [inventoryData, filterOptions, worstOffendersResult] = await Promise.all([
        fetchInventoryDashboardData(filters),
        fetchOverviewFilterOptions(),
        fetchWorstOffendersData(),
      ]);
      worstOffenders = worstOffendersResult?.items || [];
    } catch (_) {}
  } else if (tab === 'workforce') {
    try {
      [workforceData, filterOptions] = await Promise.all([
        fetchWorkforceDashboardData(filters),
        fetchOverviewFilterOptions(),
      ]);
    } catch (_) {}
  } else {
    try { filterOptions = await fetchOverviewFilterOptions(); } catch (_) {}
  }

  // Overview-dependent values (safe to compute only when isOverview)
  const currentRangeLabel = isOverview && overview
    ? formatPeriodLabel(overview.currentPeriod.start, overview.currentPeriod.end)
    : '';
  const previousRangeLabel = isOverview && overview
    ? formatPeriodLabel(overview.previousPeriod.start, overview.previousPeriod.end)
    : '';
  const activeFilterChips = isOverview && overview
    ? getActiveFilterChips(overview.activeFilters || filters)
    : getActiveFilterChips(filters);
  const noDataMsg = isOverview && overview?.latestSaleDate
    ? `No data for this period. Latest available date: ${overview.latestSaleDate}.`
    : 'No data available.';

  // Active category/item scope — shown as a badge on the trend charts when set.
  const scopeLabel = isOverview && overview
    ? (overview.activeFilters?.itemName || overview.activeFilters?.productCategory || null)
    : null;

  const kpiCards = (isOverview && overview) ? [
    {
      label: 'Total sales',
      value: formatCurrency(overview.kpis.totalSales),
      sub: currentRangeLabel,
      color: 'green',
    },
    {
      label: 'Vs previous period',
      value: formatPercent(overview.kpis.salesDeltaPct),
      sub: `Compared with ${previousRangeLabel}`,
      color: getDeltaTone(overview.kpis.salesDeltaPct),
      trend: overview.kpis.salesDeltaPct,
    },
    {
      label: 'Total tickets',
      value: formatNumber(overview.kpis.totalTickets),
      sub: currentRangeLabel,
      color: 'purple',
    },
    {
      label: 'Average ticket amount',
      value: formatCurrency(overview.kpis.avgTicketAmount),
      sub: 'Weighted by total sales and ticket count',
      color: 'cyan',
    },
    {
      label: 'Total units sold',
      value: formatNumber(overview.kpis.totalUnitsSold),
      sub: currentRangeLabel,
      color: 'purple',
    },
    {
      label: 'Out-of-stock items',
      value: formatNumber(overview.kpis.outOfStockCount),
      sub: 'Latest inventory snapshot',
      color: 'orange',
    },
    {
      label: 'Stockout-risk items',
      value: formatNumber(overview.kpis.stockoutRiskCount),
      sub: 'Latest inventory snapshot',
      color: 'orange',
    },
    {
      label: 'Dead stock (on hand)',
      value: formatNumber(overview.kpis.deadStockCount),
      sub: 'DEAD_STOCK status — latest snapshot',
      color: 'purple',
    },
    {
      label: 'Median days of cover',
      value: overview.kpis.medianDaysOfCover != null
        ? `${Number(overview.kpis.medianDaysOfCover).toFixed(1)}d`
        : '—',
      sub: 'Median stock coverage across SKUs (30d)',
      color: 'cyan',
    },
    {
      label: 'Avg days of cover (skewed by overstock)',
      value: overview.kpis.avgDaysOfCover != null
        ? `${Number(overview.kpis.avgDaysOfCover).toFixed(1)}d`
        : '—',
      sub: 'Mean — inflated by overstocked SKUs',
      color: '',
    },
  ] : [];

  return (
    <div className="od-page">
      <Link href="/projects/convenience-store" className="back-link">
        ← Convenience Store Project
      </Link>

      {/* ── Hero ── */}
      <section className={`od-hero${isOverview ? '' : ' od-hero--compact'}`}>
        <div className="od-hero-copy">
          <div className="od-meta-row">
            <span className="detail-category">Dashboard</span>
            {isOverview && overview && (
              <span className="od-freshness-pill">{formatFreshness(overview.freshness)}</span>
            )}
          </div>
          <h1 className="od-title">Convenience Store Analytics Platform</h1>
          <p className="od-subtitle">
            Overview section for fast operational review across sales pace, ticket volume,
            product winners, and current inventory risk from the reporting layer.
          </p>
          <div className="od-action-row">
            {isOverview ? (
              <a href="#recent-performance" className="btn-primary">Jump to daily table</a>
            ) : (
              <Link href="/projects/convenience-store/dashboard" className="btn-primary">Go to Overview</Link>
            )}
            <Link href="/dbt-docs/index.html" className="btn-secondary" target="_blank">
              Open dbt docs ↗
            </Link>
          </div>
        </div>

        {isOverview && overview && (
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
            <p className="od-summary-note">Comparison baseline: {previousRangeLabel}</p>
          </div>
        )}
      </section>

      {/* ── Global filters (shared across all tabs) ── */}
      <OverviewFilters
        initialFilters={overview?.activeFilters ?? filters}
        options={filterOptions}
      />

      {/* ── Tab navigation ── */}
      <Suspense fallback={<div className="dash-tab-nav" aria-hidden="true" />}>
        <DashboardTabNav />
      </Suspense>

      {/* ══ Overview tab ══════════════════════════════════════════════════════ */}
      {isOverview && overview && (
        <>
          <section className="cs-section od-section-spacing">
            <div className="od-section-head">
              <div>
                <p className="od-section-kicker">Overview</p>
                <h2 className="cs-section-title">Operational snapshot</h2>
              </div>
              <div className="od-drill-links">
                <a href="#recent-performance" className="od-inline-link">View daily detail</a>
                <a href="#overview-top-products" className="od-inline-link">View product ranking</a>
                <a href="#inventory-mix" className="od-inline-link">View inventory mix</a>
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

          {activeFilterChips.length > 0 && (
            <section className="od-active-filters" aria-label="Active filters">
              <div className="od-active-filters-head">
                <span className="od-panel-kicker">Active filters</span>
                <Link href="/projects/convenience-store/dashboard" className="od-inline-link">
                  Clear all
                </Link>
              </div>
              <div className="od-chip-row">
                {activeFilterChips.map((chip) => (
                  <span key={chip.key} className="od-filter-chip">{chip.label}</span>
                ))}
              </div>
            </section>
          )}

          <section className="od-two-col-grid od-section-spacing">
            <OverviewTrendChart
              title="Daily sales trend"
              description={`Revenue by day · ${currentRangeLabel}`}
              data={overview.dailySalesTrend}
              dataKey="sales"
              lineColor="#4F8CFF"
              valueFormat="currency-compact"
              footerLink={{ href: '#recent-performance', label: 'View daily detail' }}
              secondaryLines={[
                { dataKey: 'avg7d', name: '7-day avg', color: '#94a3b8', dashed: true },
              ]}
              noDataMessage={noDataMsg}
              activeLabel={scopeLabel}
            />
            <OverviewTrendChart
              title="Ticket count trend"
              description={`Daily transaction count · ${currentRangeLabel}`}
              data={overview.ticketTrend}
              dataKey="tickets"
              lineColor="#00D4AA"
              valueFormat="number"
              footerLink={{ href: '#recent-performance', label: 'Inspect daily rows' }}
              noDataMessage={noDataMsg}
              activeLabel={scopeLabel}
            />
          </section>

          <section className="od-two-col-grid od-section-spacing">
            <OverviewTopProductsChart
              data={overview.topProducts}
              metric={overview.topProductsMetric}
              enableCategoryFilter
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
        </>
      )}

      {/* ══ Other tabs — placeholders until implemented ═══════════════════════ */}
      {tab === 'sales'     && <SalesTabContent data={salesData} />}
      {tab === 'inventory' && <InventoryTabContent data={inventoryData} filterOptions={filterOptions} worstOffenders={worstOffenders} />}
      {tab === 'products'  && <ProductsTabContent data={productsData} filterOptions={filterOptions} />}
      {tab === 'workforce' && <WorkforceTabContent data={workforceData} />}
    </div>
  );
}
