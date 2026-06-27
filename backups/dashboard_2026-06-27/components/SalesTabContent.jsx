import OverviewTrendChart from '@/components/OverviewTrendChart';
import SalesByHourChart from '@/components/SalesByHourChart';
import PaymentMixDonut from '@/components/PaymentMixDonut';

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function formatPeriodLabel(start, end) {
  if (!start || !end) return 'Selected period';
  const fmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt.format(new Date(`${start}T00:00:00`))} – ${fmt.format(new Date(`${end}T00:00:00`))}`;
}

function SalesKpiCard({ label, value, sub, color = 'cyan', trend }) {
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
        <p className={`dash-kpi-trend ${toneClass}`}>{arrow} {Math.abs(trend).toFixed(1)}%</p>
      )}
    </div>
  );
}

export default function SalesTabContent({ data }) {
  if (!data) return null;

  const {
    currentPeriod, previousPeriod,
    kpis, salesTrend, avgTicketTrend,
    paymentMix, hourlyBreakdown, returnsByProduct,
  } = data;

  const periodLabel = formatPeriodLabel(currentPeriod.start, currentPeriod.end);
  const prevLabel = formatPeriodLabel(previousPeriod.start, previousPeriod.end);

  const kpiCards = [
    {
      label: 'Net sales',
      value: formatCurrency(kpis.totalSales),
      sub: periodLabel,
      color: 'green',
    },
    {
      label: 'Vs previous period',
      value: formatPercent(kpis.salesDeltaPct),
      sub: `Compared with ${prevLabel}`,
      color: kpis.salesDeltaPct == null ? 'cyan'
           : kpis.salesDeltaPct >= 0 ? 'green' : 'orange',
      trend: kpis.salesDeltaPct,
    },
    {
      label: 'Units sold',
      value: Number(kpis.totalUnitsSold).toLocaleString('he-IL'),
      sub: periodLabel,
      color: 'purple',
    },
    {
      label: 'Ticket count',
      value: Number(kpis.totalTickets).toLocaleString('he-IL'),
      sub: periodLabel,
      color: 'purple',
    },
    {
      label: 'Avg ticket amount',
      value: formatCurrency(kpis.avgTicketAmount),
      sub: 'Total sales ÷ ticket count',
      color: 'cyan',
    },
    {
      label: 'Return rate',
      value: kpis.returnRate != null ? `${kpis.returnRate.toFixed(2)}%` : '—',
      sub: 'Return amount as % of sales',
      color: kpis.returnRate != null && kpis.returnRate > 5 ? 'orange' : 'cyan',
    },
  ];

  return (
    <>
      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <section className="cs-section od-section-spacing">
        <div className="od-section-head">
          <div>
            <p className="od-section-kicker">Sales</p>
            <h2 className="cs-section-title">Sales performance</h2>
          </div>
          <span className="od-faint-note">{periodLabel}</span>
        </div>
        <div className="dash-kpi-dark-grid">
          {kpiCards.map(card => (
            <SalesKpiCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* ── Daily trend + avg ticket trend ─────────────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing">
        <OverviewTrendChart
          title="Daily sales trend"
          description={`Revenue by day · ${periodLabel}`}
          data={salesTrend}
          dataKey="sales"
          lineColor="#22c55e"
          valueFormat="currency-compact"
          secondaryLines={[
            { dataKey: 'avg7d', name: '7-day avg', color: '#94a3b8', dashed: true },
          ]}
        />
        <OverviewTrendChart
          title="Average ticket trend"
          description={`Avg transaction value by day · ${periodLabel}`}
          data={avgTicketTrend}
          dataKey="avgTicket"
          lineColor="#6366f1"
          valueFormat="currency"
          secondaryLines={[
            { dataKey: 'avg7d', name: '7-day avg', color: '#94a3b8', dashed: true },
          ]}
        />
      </section>

      {/* ── Sales by hour + payment mix ─────────────────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing">
        <SalesByHourChart data={hourlyBreakdown} />
        <PaymentMixDonut data={paymentMix} periodLabel={periodLabel} />
      </section>

      {/* ── Returns breakdown ──────────────────────────────────────────────── */}
      <section className="od-section-spacing">
        <div className="od-panel">
          <div className="od-panel-head">
            <div>
              <p className="od-panel-kicker">Returns · {periodLabel}</p>
              <h3>Top returning products</h3>
            </div>
            {returnsByProduct.length > 0 && (
              <span className="od-faint-note">{returnsByProduct.length} products</span>
            )}
          </div>
          <p className="od-panel-copy">
            Products ranked by return amount within the selected period.
          </p>
          {returnsByProduct.length === 0 ? (
            <div className="table-empty od-empty-card">
              <span>✓</span>
              <p>No returns recorded for this period.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Return qty</th>
                    <th>Return amount</th>
                    <th>Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {returnsByProduct.map((row, i) => (
                    <tr key={`${row.itemId}-${i}`} className="table-row">
                      <td>{row.itemName}</td>
                      <td>{row.categoryName}</td>
                      <td>{Number(row.returnQty).toLocaleString('he-IL')}</td>
                      <td>{formatCurrency(row.returnAmount)}</td>
                      <td>{Number(row.returnTickets).toLocaleString('he-IL')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
