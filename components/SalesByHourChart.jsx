'use client';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function getHourColor(hour) {
  if (hour >= 6 && hour <= 11) return '#6366f1';
  if (hour >= 12 && hour <= 15) return '#f59e0b';
  if (hour >= 16 && hour <= 20) return '#22d3ee';
  if (hour >= 21) return '#94a3b8';
  return '#475569';
}

function HourTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      <p style={{ color: '#22d3ee' }}>
        Sales: <strong>₪{Number(d.totalSales || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Tickets: <strong>{Number(d.totalTickets || 0).toLocaleString('he-IL')}</strong>
      </p>
    </div>
  );
}

export default function SalesByHourChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Timing</p>
            <h3>Sales by hour of day</h3>
          </div>
        </div>
        <p className="od-panel-copy">Aggregated sales by hour across the selected period.</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No hourly data for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Timing</p>
          <h3>Sales by hour of day</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Aggregated across the selected period. Identifies peak trading hours for staffing decisions.
      </p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Number((v / 1000).toFixed(1))}k`}
              width={52}
            />
            <Tooltip content={<HourTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <Bar dataKey="totalSales" name="Sales" radius={[3, 3, 0, 0]}>
              {data.map((entry) => (
                <Cell key={`cell-${entry.hour}`} fill={getHourColor(entry.hour)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="inv-scatter-legend">
        <span style={{ color: '#6366f1', fontSize: '0.8rem' }}>■ Morning (06–11)</span>
        <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>■ Midday (12–15)</span>
        <span style={{ color: '#22d3ee', fontSize: '0.8rem' }}>■ Evening (16–20)</span>
        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>■ Night (21+)</span>
      </div>
    </div>
  );
}
