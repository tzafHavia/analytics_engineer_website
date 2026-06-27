import InventoryStatusDonut from '@/components/InventoryStatusDonut';
import DaysOfCoverHistogram from '@/components/DaysOfCoverHistogram';
import InventoryScatterChart from '@/components/InventoryScatterChart';
import InventoryActionTable from '@/components/InventoryActionTable';
import InventoryHealthTrendChart from '@/components/InventoryHealthTrendChart';
import InventoryStatusCompositionChart from '@/components/InventoryStatusCompositionChart';

function formatDoc(days) {
  if (days == null) return '—';
  return `${Number(days).toFixed(1)}d`;
}

function InvKpiCard({ label, value, sub, color = 'cyan', chip }) {
  return (
    <div className={`dash-kpi-card dash-kpi-${color}`}>
      <p className="dash-kpi-label">{label}</p>
      <p className="dash-kpi-value">{value}</p>
      {sub && <p className="dash-kpi-sub">{sub}</p>}
      {chip && (
        <p className={`dash-kpi-trend ${chip.toneClass}`}>{chip.arrow} {chip.text}</p>
      )}
    </div>
  );
}

/**
 * Builds an inverted WoW chip from the at-risk count delta:
 * rising at-risk is BAD → red/down tone; falling is GOOD → green/up tone.
 * `atRiskWowDelta` is a raw count change (units), not a percentage.
 */
function buildAtRiskChip(delta) {
  if (delta == null || Number.isNaN(Number(delta))) return null;
  const d = Number(delta);
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '–';
  const toneClass =
    d > 0 ? 'dash-kpi-trend-down' :  // rising at-risk = bad
    d < 0 ? 'dash-kpi-trend-up' :    // falling at-risk = good
    'dash-kpi-trend-flat';
  const sign = d > 0 ? '+' : '';
  return { arrow, toneClass, text: `${sign}${d.toLocaleString('he-IL')} WoW` };
}

export default function InventoryTabContent({ data }) {
  if (!data) return null;

  const {
    snapshotDate, kpis,
    inventoryDistribution, coverHistogram,
    scatterData, reorderItems, overstockItems, deadStockItems,
    healthTrend, healthTrendSummary, trendPeriod,
  } = data;

  const snapshotLabel = snapshotDate ? `Snapshot: ${snapshotDate}` : 'Latest snapshot';
  const trendScoped = trendPeriod?.scoped;
  const atRiskChip = buildAtRiskChip(healthTrendSummary?.atRiskWowDelta ?? null);

  const kpiCards = [
    { label: 'Total SKUs tracked',  value: kpis.totalItems.toLocaleString('he-IL'), sub: snapshotLabel,                          color: 'cyan'   },
    { label: 'Out of stock',         value: kpis.outOfStockCount.toLocaleString('he-IL'), sub: 'Needs immediate reorder',         color: 'red'    },
    { label: 'Stockout risk',        value: kpis.stockoutRiskCount.toLocaleString('he-IL'), sub: 'Low stock — act soon',          color: 'orange', chip: atRiskChip },
    { label: 'Overstocked',          value: kpis.overstockCount.toLocaleString('he-IL'), sub: 'Excess vs. 30d pace',             color: 'green'  },
    { label: 'Dead stock',           value: kpis.deadStockCount.toLocaleString('he-IL'), sub: 'Dead stock (latest snapshot)',    color: 'purple' },
    { label: 'Avg days of cover',    value: formatDoc(kpis.avgDaysOfCover),                sub: 'Avg across all tracked SKUs',   color: 'cyan'   },
  ];

  return (
    <>
      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <section className="cs-section od-section-spacing">
        <div className="od-section-head">
          <div>
            <p className="od-section-kicker">Inventory</p>
            <h2 className="cs-section-title">Inventory health snapshot</h2>
          </div>
          {snapshotDate && (
            <span className="od-faint-note">
              {snapshotLabel}
              {trendScoped ? ' · latest snapshot, not affected by the date filter' : ''}
            </span>
          )}
        </div>
        <div className="dash-kpi-dark-grid">
          {kpiCards.map(card => (
            <InvKpiCard
              key={card.label}
              label={card.label}
              value={card.value}
              sub={card.sub}
              color={card.color}
              chip={card.chip}
            />
          ))}
        </div>
      </section>

      {/* ── Action plan (lead with the action) ─────────────────────────────── */}
      <section className="od-section-spacing od-section--lead">
        <div className="od-section-head" style={{ marginBottom: '1.25rem' }}>
          <div>
            <p className="od-section-kicker">Action items</p>
            <h2 className="cs-section-title">Inventory action plan</h2>
          </div>
        </div>
        <InventoryActionTable
          reorderItems={reorderItems}
          overstockItems={overstockItems}
          deadStockItems={deadStockItems}
        />
      </section>

      {/* ── Health trend + status composition over time ────────────────────── */}
      <section className="od-section-spacing od-section--secondary od-section--supporting-start">
        <div className="od-section-head" style={{ marginBottom: '1rem' }}>
          <div>
            <p className="od-section-kicker">Trend over time</p>
            <h2 className="cs-section-title">Inventory health trend</h2>
          </div>
          {trendPeriod?.label && (
            <span className="od-faint-note">{trendPeriod.label}</span>
          )}
        </div>
        <div className="od-two-col-grid">
          <InventoryHealthTrendChart
          data={healthTrend}
          wowDelta={healthTrendSummary?.atRiskWowDelta ?? null}
        />
          <InventoryStatusCompositionChart data={healthTrend} />
        </div>
      </section>

      {/* ── Status donut + coverage histogram ──────────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing od-section--secondary">
        <InventoryStatusDonut
          data={inventoryDistribution}
          snapshotDate={snapshotDate}
        />
        <DaysOfCoverHistogram data={coverHistogram} />
      </section>

      {/* ── Scatter plot ───────────────────────────────────────────────────── */}
      <section className="od-section-spacing od-section--secondary">
        <InventoryScatterChart data={scatterData} />
      </section>
    </>
  );
}
