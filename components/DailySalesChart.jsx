'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        <p style={{ color: '#6366f1' }}>
          Revenue:{' '}
          <strong>
            ₪{Number(payload[0].value).toLocaleString('he-IL', { minimumFractionDigits: 0 })}
          </strong>
        </p>
      </div>
    );
  }
  return null;
}

export default function DailySalesChart({ data = [] }) {
  return (
    <div className="cs-chart-wrapper">
      <div className="cs-chart-header">
        <span className="cs-chart-title">Daily Revenue</span>
        <span className="live-label" style={{ fontSize: '0.75rem' }}>
          <span className="live-dot" /> Live Data
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.1)' }} />
          <Bar dataKey="total" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
