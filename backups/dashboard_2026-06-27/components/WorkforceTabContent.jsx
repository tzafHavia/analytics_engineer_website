import EmployeeOvertimeChart from '@/components/EmployeeOvertimeChart';
import EmployeeTrendChart from '@/components/EmployeeTrendChart';
import WorkforceScorecard from '@/components/WorkforceScorecard';

const EMPLOYEE_COLORS = ['#4F8CFF', '#00D4AA', '#A855F7'];

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatHours(value) {
  return `${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}h`;
}

function WorkforceKpiCard({ label, value, sub, color = 'cyan' }) {
  return (
    <div className={`dash-kpi-card dash-kpi-${color}`}>
      <p className="dash-kpi-label">{label}</p>
      <p className="dash-kpi-value">{value}</p>
      {sub && <p className="dash-kpi-sub">{sub}</p>}
    </div>
  );
}

export default function WorkforceTabContent({ data }) {
  if (!data) return null;

  const { employees = [], dailyTrend = [], trendDays = 0, kpis, period } = data;

  if (!employees.length) {
    return (
      <section className="cs-section od-section-spacing">
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>{period?.label ? `No workforce data for ${period.label}.` : 'No workforce data available yet.'}</p>
        </div>
      </section>
    );
  }

  // Color per employee (stable by sales-rank order from the query).
  const colorFor = {};
  employees.forEach((e, i) => { colorFor[e.employeeId] = EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length]; });

  // Overtime chart: one row per employee with the three tier columns.
  const overtimeData = employees.map((e) => ({
    employeeName: e.employeeName,
    regularHours: e.regularHours,
    ot125Hours: e.ot125Hours,
    ot150Hours: e.ot150Hours,
  }));

  // Trend chart: pivot daily rows to one row per date, a column per employee.
  const trendSeries = employees.map((e) => ({
    key: `emp_${e.employeeId}`,
    name: e.employeeName,
    color: colorFor[e.employeeId],
  }));
  const byDate = new Map();
  for (const row of dailyTrend) {
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date });
    byDate.get(row.date)[`emp_${row.employeeId}`] = row.salesAmount;
  }
  const pivotedTrend = Array.from(byDate.values());

  const kpiCards = [
    {
      label: 'Attributed sales',
      value: formatCurrency(kpis.totalAttributedSales),
      sub: 'Team total (hour-share basis)',
      color: 'green',
    },
    {
      label: 'Total payroll cost',
      value: formatCurrency(kpis.totalPay),
      sub: 'Regular + overtime pay',
      color: 'orange',
    },
    {
      label: 'Labor efficiency',
      value: `₪${Number(kpis.teamEfficiency || 0).toFixed(2)}`,
      sub: 'Sales per ₪1 of labor cost',
      color: 'cyan',
    },
    {
      label: 'Total hours',
      value: formatHours(kpis.totalHours),
      sub: `Across ${Number(kpis.totalShifts).toLocaleString('he-IL')} shifts`,
      color: 'purple',
    },
    {
      label: 'Blended hourly cost',
      value: `₪${Number(kpis.blendedHourlyCost || 0).toFixed(2)}`,
      sub: 'Pay ÷ hours (rises with overtime)',
      color: 'cyan',
    },
  ];

  return (
    <>
      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <section className="cs-section od-section-spacing">
        <div className="od-section-head">
          <div>
            <p className="od-section-kicker">Workforce</p>
            <h2 className="cs-section-title">Team productivity & payroll</h2>
          </div>
          <span className="od-faint-note">
            {employees.length} employees{period?.label ? ` · ${period.label}` : ''}
          </span>
        </div>
        <div className="dash-kpi-dark-grid">
          {kpiCards.map((card) => (
            <WorkforceKpiCard key={card.label} {...card} />
          ))}
        </div>
        <p className="dash-tab-placeholder-disclaimer" style={{ marginTop: '1rem' }}>
          ⚠ Employee sales values are estimated using each employee&apos;s share of worked hours,
          not direct transaction ownership.
        </p>
      </section>

      {/* ── Team scorecard ─────────────────────────────────────────────────── */}
      <section className="od-section-spacing">
        <div className="od-panel">
          <div className="od-panel-head">
            <div>
              <p className="od-panel-kicker">Scorecard</p>
              <h3>Per-employee performance</h3>
            </div>
          </div>
          <p className="od-panel-copy">
            Ranks diverge across dimensions — switch the metric to crown a different leader.
          </p>
          <WorkforceScorecard employees={employees} />
        </div>
      </section>

      {/* ── Overtime split + daily trend ───────────────────────────────────── */}
      <section className="od-two-col-grid od-section-spacing">
        <EmployeeOvertimeChart data={overtimeData} />
        <EmployeeTrendChart data={pivotedTrend} series={trendSeries} trendDays={trendDays} />
      </section>

      {/* ── Detail table ───────────────────────────────────────────────────── */}
      <section className="od-section-spacing">
        <div className="od-panel">
          <div className="od-panel-head">
            <div>
              <p className="od-panel-kicker">Detail</p>
              <h3>Employee scorecard table</h3>
            </div>
          </div>
          <div className="table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shifts</th>
                  <th>Hours</th>
                  <th>OT hours</th>
                  <th>Total pay</th>
                  <th>Attributed sales</th>
                  <th>Sales / ₪</th>
                  <th>Ranks (S/H/E)</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.employeeId} className="table-row">
                    <td dir="rtl">{e.employeeName}</td>
                    <td>{Number(e.totalShifts).toLocaleString('he-IL')}</td>
                    <td>{e.totalHours.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                    <td>{(e.ot125Hours + e.ot150Hours).toLocaleString('he-IL', { maximumFractionDigits: 1 })}</td>
                    <td>{formatCurrency(e.totalPay)}</td>
                    <td>{formatCurrency(e.attributedSales)}</td>
                    <td>₪{e.salesPerLaborShekel.toFixed(2)}</td>
                    <td>{e.salesRank} / {e.hoursRank} / {e.efficiencyRank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
