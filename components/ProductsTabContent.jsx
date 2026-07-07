import OverviewTopProductsChart from '@/components/OverviewTopProductsChart';
import CategoryGrossProfitBar from '@/components/CategoryGrossProfitBar';
import ProductScatterChart from '@/components/ProductScatterChart';
import ShowMoreTable from '@/components/ShowMoreTable';
import TabFilterBar from '@/components/TabFilterBar';

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatDoc(days) {
  if (days == null) return '—';
  return `${Number(days).toFixed(1)}d`;
}

/** Placeholder rows (unmapped/uncategorized) sort after real items. */
function isPlaceholderRow(row) {
  return (
    row?.itemName === '(unmapped item)' ||
    row?.categoryName === '(uncategorized)' ||
    row?.name === '(uncategorized)'
  );
}

/** Stable reorder: real items first, placeholder rows grouped at the bottom. */
function realItemsFirst(rows = []) {
  return [...rows].sort(
    (left, right) => (isPlaceholderRow(left) ? 1 : 0) - (isPlaceholderRow(right) ? 1 : 0),
  );
}

function ProductKpiCard({ label, value, sub, color = 'cyan' }) {
  return (
    <div className={`dash-kpi-card dash-kpi-${color}`}>
      <p className="dash-kpi-label">{label}</p>
      <p className="dash-kpi-value">{value}</p>
      {sub && <p className="dash-kpi-sub">{sub}</p>}
    </div>
  );
}

function VelocityBadge({ band }) {
  const b = String(band || '').toUpperCase();
  if (b === 'FAST')            return <span className="inv-badge inv-badge-green">Fast</span>;
  if (b === 'STEADY')          return <span className="inv-badge inv-badge-blue">Steady</span>;
  if (b === 'SLOW')            return <span className="inv-badge inv-badge-amber">Slow</span>;
  if (b === 'NO_RECENT_SALES') return <span className="inv-badge inv-badge-gray">No sales</span>;
  if (b === 'OUT_OF_STOCK')    return <span className="inv-badge inv-badge-red">Out of stock</span>;
  return <span className="inv-badge inv-badge-blue">{band || '—'}</span>;
}

export default function ProductsTabContent({ data, filterOptions = {} }) {
  if (!data) return null;

  const { kpis, topProducts, scatterData, period } = data;
  const slowMovers = realItemsFirst(data.slowMovers);
  const categoryData = realItemsFirst(data.categoryData);

  const tabSelectors = [
    {
      param: 'velocityBand',
      label: 'Velocity band',
      allLabel: 'All velocity bands',
      options: filterOptions.velocityBands || [],
    },
    {
      param: 'stockStatus',
      label: 'Stock status',
      allLabel: 'All stock states',
      options: filterOptions.stockStatuses || [],
    },
  ];

  const scoped = period?.scoped;
  const periodLabel = period?.label || 'Rolling 30-day window';

  const topProductMetric = {
    key: 'salesAmount30d',
    label: scoped ? 'Revenue' : 'Revenue (30d)',
    heading: 'Top 10 products by revenue',
    description: scoped
      ? `Top sellers for ${periodLabel}.`
      : 'Rolling 30-day window — not affected by the date filter.',
    valueFormat: 'currency-compact',
  };

  const kpiCards = [
    {
      label: 'Top product by revenue',
      value: kpis.topProductByRevenue ? formatCurrency(kpis.topProductByRevenue.salesAmount) : '—',
      sub: kpis.topProductByRevenue ? kpis.topProductByRevenue.itemName : 'No data',
      color: 'green',
    },
    {
      label: 'Top product by units',
      value: kpis.topProductByUnits
        ? `${Number(kpis.topProductByUnits.unitsSold).toLocaleString('he-IL', { maximumFractionDigits: 0 })} units`
        : '—',
      sub: kpis.topProductByUnits ? kpis.topProductByUnits.itemName : 'No data',
      color: 'purple',
    },
    {
      label: 'Slow & dead movers',
      value: Number(kpis.slowAndDeadCount).toLocaleString('he-IL'),
      sub: 'Slow + no-sales + OOS · 30d',
      color: 'orange',
    },
    {
      label: 'Top category by revenue',
      value: kpis.topCategoryByRevenue ? formatCurrency(kpis.topCategoryByRevenue.salesAmount) : '—',
      sub: kpis.topCategoryByRevenue ? kpis.topCategoryByRevenue.categoryName : 'No data',
      color: 'cyan',
    },
    {
      label: 'Top category by GP',
      value: kpis.topCategoryByProfit ? formatCurrency(kpis.topCategoryByProfit.profitAmount) : '—',
      sub: kpis.topCategoryByProfit ? kpis.topCategoryByProfit.categoryName : 'No data',
      color: 'cyan',
    },
  ];

  return (
    <>
      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <section className="cs-section od-section-spacing">
        <div className="od-section-head">
          <div>
            <p className="od-section-kicker">Products & Categories</p>
            <h2 className="cs-section-title">Product & category performance</h2>
          </div>
          <span className="od-faint-note">{periodLabel}</span>
        </div>
        <TabFilterBar selectors={tabSelectors} />
        <div className="dash-kpi-dark-grid">
          {kpiCards.map(card => (
            <ProductKpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* ── Top 10 bar + Category gross-profit bar ─────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing od-section--lead">
        <OverviewTopProductsChart
          data={topProducts}
          metric={topProductMetric}
        />
        <CategoryGrossProfitBar data={categoryData} />
      </section>

      {/* ── Sales vs GP scatter ─────────────────────────────────────────────── */}
      <section className="od-section-spacing od-section--secondary od-section--supporting-start">
        {scoped && (
          <div className="od-section-head" style={{ marginBottom: '0.75rem' }}>
            <div>
              <p className="od-section-kicker">Profitability</p>
            </div>
            <span className="od-faint-note">30-day rolling — not affected by the date filter</span>
          </div>
        )}
        <ProductScatterChart data={scatterData} />
      </section>

      {/* ── Slow movers + Category ranking ─────────────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing od-section--secondary">
        <div className="od-panel">
          <div className="od-panel-head">
            <div>
              <p className="od-panel-kicker">Slow movers · {slowMovers.length} items</p>
              <h3>Dead & slow-moving products</h3>
            </div>
            {scoped && <span className="od-faint-note">30-day rolling</span>}
          </div>
          <p className="od-panel-copy">
            Lowest 30-day velocity. Consider markdown, bundling, or removal.
          </p>
          {slowMovers.length === 0 ? (
            <div className="table-empty od-empty-card">
              <span>✓</span>
              <p>No slow movers found.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Velocity</th>
                    <th>Sold 30d</th>
                    <th>On hand</th>
                    <th>Days cover</th>
                  </tr>
                </thead>
                <ShowMoreTable initial={12} label="items">
                  {slowMovers.map((row, i) => (
                    <tr key={`${row.itemId}-${i}`} className="table-row">
                      <td>{row.itemName}</td>
                      <td>{row.categoryName}</td>
                      <td><VelocityBadge band={row.velocityBand} /></td>
                      <td>{Number(row.soldQty30d).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                      <td>{Number(row.inventoryQty).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                      <td>{formatDoc(row.daysOfCover30d)}</td>
                    </tr>
                  ))}
                </ShowMoreTable>
              </table>
            </div>
          )}
        </div>

        <div className="od-panel">
          <div className="od-panel-head">
            <div>
              <p className="od-panel-kicker">Categories · {categoryData.length} total</p>
              <h3>Category ranking</h3>
            </div>
          </div>
          <p className="od-panel-copy">
            {scoped ? `All categories ranked by revenue · ${periodLabel}.` : 'All categories ranked by 30-day revenue.'}
          </p>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category</th>
                  <th>Sales (30d)</th>
                  <th>Est. GP</th>
                  <th>Dead SKUs</th>
                </tr>
              </thead>
              <ShowMoreTable initial={12} label="categories">
                {categoryData.map((row, i) => (
                  <tr key={row.name} className="table-row">
                    <td style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: row.color, display: 'inline-block', flexShrink: 0 }} />
                        {row.name}
                      </span>
                    </td>
                    <td>{formatCurrency(row.value)}</td>
                    <td>{row.profit > 0 ? formatCurrency(row.profit) : '—'}</td>
                    <td style={{ color: row.deadStockCount > 0 ? '#f59e0b' : '#64748b' }}>
                      {row.deadStockCount > 0 ? row.deadStockCount : '—'}
                    </td>
                  </tr>
                ))}
              </ShowMoreTable>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
