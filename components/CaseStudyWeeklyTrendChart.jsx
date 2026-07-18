'use client';
import {
  Bar, CartesianGrid, ComposedChart, Line, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

function formatWeekLabel(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function WeeklyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">Week of {formatWeekLabel(label)}</p>
      <p style={{ color: '#4F8CFF' }}>
        Net sales: <strong>₪{Number(d.netSales || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#00D4AA' }}>
        Tickets: <strong>{Number(d.tickets || 0).toLocaleString('he-IL')}</strong>
      </p>
    </div>
  );
}

// Weekly net-sales + ticket-count trend (last 12 ISO weeks, live) — mirrors the
// real weekly summary report delivered to the client every Sunday.
export default function CaseStudyWeeklyTrendChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="table-empty od-empty-card">
        <span>∅</span>
        <p>No weekly data available.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickFormatter={formatWeekLabel}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="sales"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₪${Number((v / 1000).toFixed(1))}k`}
          width={56}
        />
        <YAxis yAxisId="tickets" orientation="right" hide />
        <Tooltip content={<WeeklyTooltip />} cursor={{ fill: 'rgba(79,140,255,0.08)' }} />
        <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
        <Bar yAxisId="sales" dataKey="netSales" name="Weekly net sales" fill="#4F8CFF" radius={[4, 4, 0, 0]} maxBarSize={30} />
        <Line
          yAxisId="tickets"
          type="monotone"
          dataKey="tickets"
          name="Tickets"
          stroke="#00D4AA"
          strokeWidth={2}
          dot={{ r: 2.5, fill: '#00D4AA' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
