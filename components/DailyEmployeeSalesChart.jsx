'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Multi-series palette built from the design tokens / chart hexes used elsewhere.
// Leads with brand blue / teal / purple, then extends with a few distinct hues
// so ~5–10 employees stay readable.
const SERIES_PALETTE = [
  '#4F8CFF', // blue (brand primary)
  '#00D4AA', // teal (brand accent)
  '#A855F7', // analytics purple
  '#f59e0b', // amber
  '#22d3ee', // cyan
  '#ef4444', // red
  '#4ade80', // green
  '#f472b6', // pink
  '#818cf8', // indigo
  '#fbbf24', // gold
];

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit' }).format(d);
}

function fmtCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

// Legend renderer that forces RTL on Hebrew employee names.
function rtlLegend({ payload }) {
  if (!payload?.length) return null;
  return (
    <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', justifyContent: 'center', margin: 0, padding: 0, listStyle: 'none', fontSize: '0.78rem' }}>
      {payload.map((entry) => (
        <li key={entry.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: entry.color, display: 'inline-block' }} />
          <span dir="rtl">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

function DailyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const entries = payload
    .filter((p) => Number(p.value || 0) !== 0)
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const total = payload.reduce((s, p) => s + Number(p.value || 0), 0);
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{fmtDate(label)}</p>
      {entries.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} dir="rtl">
          <span dir="rtl">{p.name}</span>:{' '}
          <strong>{fmtCurrency(p.value)}</strong>
        </p>
      ))}
      <p style={{ color: '#94a3b8' }}>
        Total: <strong>{fmtCurrency(total)}</strong>
      </p>
    </div>
  );
}

export default function DailyEmployeeSalesChart({ data = [] }) {
  // `data` is the flat dailyEmployeeSales array:
  //   { date, employeeId, employeeName (Hebrew), sales }
  const hasData = Array.isArray(data) && data.length > 0;

  if (!hasData) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Recent form</p>
            <h3>Daily attributed sales by employee</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card"><span>∅</span><p>No daily detail available.</p></div>
      </div>
    );
  }

  // ── Build the distinct employee set, ordered by total sales desc (stable). ──
  const totalsByEmp = new Map(); // key -> { name, total }
  for (const row of data) {
    const key = String(row.employeeId);
    const cur = totalsByEmp.get(key) || { name: row.employeeName, total: 0 };
    cur.total += Number(row.sales || 0);
    if (!cur.name) cur.name = row.employeeName;
    totalsByEmp.set(key, cur);
  }
  const employees = Array.from(totalsByEmp.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, info], i) => ({
      key: `emp_${key}`,
      name: info.name,
      color: SERIES_PALETTE[i % SERIES_PALETTE.length],
    }));

  // ── Pivot the flat array into one row per date, a column per employee. ──
  // NOTE: the owner wants the LOWER segment of each bar to eventually be the
  // morning shift (colored by person), with evening stacked above. That
  // morning/evening shift split is NOT in the data yet (pending a data
  // request), so for now we stack purely by employee — no faked split.
  const byDate = new Map();
  for (const row of data) {
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date });
    const rec = byDate.get(row.date);
    rec[`emp_${row.employeeId}`] = (rec[`emp_${row.employeeId}`] || 0) + Number(row.sales || 0);
  }
  const rows = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Recent form</p>
          <h3>Daily attributed sales by employee</h3>
        </div>
        <span className="od-faint-note">Last {rows.length} days</span>
      </div>
      <p className="od-panel-copy">
        Each day&apos;s store sales split across the employees who worked, by their share of worked
        hours. Bars stack one segment per employee.
      </p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Number((v / 1000).toFixed(1))}k`}
              width={48}
            />
            <Tooltip content={<DailyTooltip />} cursor={{ fill: 'rgba(79,140,255,0.08)' }} />
            <Legend content={rtlLegend} />
            {employees.map((e, i) => (
              <Bar
                key={e.key}
                dataKey={e.key}
                name={e.name}
                stackId="empSales"
                fill={e.color}
                radius={i === employees.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="od-chart-caption">
        Per-employee daily attributed sales. A morning / evening shift split (lower segment =
        morning) is planned once shift-level data is available.
      </p>
    </div>
  );
}
