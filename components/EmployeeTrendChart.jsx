'use client';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d);
}

function TrendTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{fmtDate(label)}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <p key={p.dataKey} style={{ color: p.color }} dir="rtl">
            <span dir="rtl">{s ? s.name : p.dataKey}</span>:{' '}
            <strong>₪{Number(p.value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
          </p>
        );
      })}
    </div>
  );
}

export default function EmployeeTrendChart({ data = [], series = [], trendDays = 0 }) {
  if (!data.length || !series.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Recent form</p>
            <h3>Daily attributed sales</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card"><span>∅</span><p>No daily detail available.</p></div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Recent form</p>
          <h3>Daily attributed sales</h3>
        </div>
        {trendDays > 0 && <span className="od-faint-note">Last {trendDays} days</span>}
      </div>
      <p className="od-panel-copy">
        Attributed daily sales by employee — each employee&apos;s share of store sales by worked hours.
      </p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
              width={48}
            />
            <Tooltip content={<TrendTooltip series={series} />} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
