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

function InvKpiCard({ label, value, sub, color = 'cyan' }) {
  return (
    <div className={`dash-kpi-card dash-kpi-${color}`}>
      <p className="dash-kpi-label">{label}</p>
      <p className="dash-kpi-value">{value}</p>
      {sub && <p className="dash-kpi-sub">{sub}</p>}
    </div>
  );
}

export default function InventoryTabContent({ data }) {
  if (!data) return null;

  const {
    snapshotDate, kpis,
    inventoryDistribution, coverHistogram,
    scatterData, reorderItems, overstockItems, deadStockItems,
    healthTrend, healthTrendSummary,
  } = data;

  const snapshotLabel = snapshotDate ? `Snapshot: ${snapshotDate}` : 'Latest snapshot';

  const kpiCards = [
    { label: 'Total SKUs tracked',  value: kpis.totalItems.toLocaleString('he-IL'), sub: snapshotLabel,                          color: 'cyan'   },
    { label: 'Out of stock',         value: kpis.outOfStockCount.toLocaleString('he-IL'), sub: 'Needs immediate reorder',         color: 'red'    },
    { label: 'Stockout risk',        value: kpis.stockoutRiskCount.toLocaleString('he-IL'), sub: 'Low stock — act soon',          color: 'orange' },
    { label: 'Overstocked',          value: kpis.overstockCount.toLocaleString('he-IL'), sub: 'Excess vs. 30d pace',             color: 'green'  },
    { label: 'Dead stock',           value: kpis.deadStockCount.toLocaleString('he-IL'), sub: 'Near-zero velocity (30d)',        color: 'purple' },
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
            <span className="od-faint-note">{snapshotLabel}</span>
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
            />
          ))}
        </div>
      </section>

      {/* ── Health trend + status composition over time ────────────────────── */}
      <section className="od-two-col-grid od-section-spacing">
        <InventoryHealthTrendChart
          data={healthTrend}
          wowDelta={healthTrendSummary?.atRiskWowDelta ?? null}
        />
        <InventoryStatusCompositionChart data={healthTrend} />
      </section>

      {/* ── Status donut + coverage histogram ──────────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing">
        <InventoryStatusDonut
          data={inventoryDistribution}
          snapshotDate={snapshotDate}
        />
        <DaysOfCoverHistogram data={coverHistogram} />
      </section>

      {/* ── Scatter plot ───────────────────────────────────────────────────── */}
      <section className="od-section-spacing">
        <InventoryScatterChart data={scatterData} />
      </section>

      {/* ── Action tables ──────────────────────────────────────────────────── */}
      <section className="od-section-spacing">
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
    </>
  );
}
