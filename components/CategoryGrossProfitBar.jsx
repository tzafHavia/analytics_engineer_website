'use client';
import {
  Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function truncateLabel(value) {
  if (!value) return '—';
  return value.length > 20 ? `${value.slice(0, 20)}…` : value;
}

function GpTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const margin = d.value > 0 ? (d.profit / d.value) * 100 : null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{d.name}</p>
      <p style={{ color: '#4ade80' }}>
        Est. gross profit: <strong>{formatCurrency(d.profit)}</strong>
      </p>
      <p style={{ color: '#22d3ee' }}>
        Revenue: <strong>{formatCurrency(d.value)}</strong>
      </p>
      {margin != null && (
        <p style={{ color: '#94a3b8' }}>
          Est. margin: <strong>{margin.toFixed(1)}%</strong>
        </p>
      )}
    </div>
  );
}

export default function CategoryGrossProfitBar({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Categories · Rolling 30d</p>
            <h3>Gross profit by category</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No category data available.</p>
        </div>
      </div>
    );
  }

  // Sort by estimated gross profit, descending.
  const chartData = [...data]
    .map((d) => ({ ...d, profit: Number(d.profit || 0) }))
    .sort((a, b) => b.profit - a.profit);

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Categories · Rolling 30d</p>
          <h3>Gross profit by category</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Categories ranked by estimated gross profit. Margin leaders aren&apos;t always revenue
        leaders — a high-revenue category can sink down the list once cost is netted out.
      </p>
      <p className="od-chart-caption">Revenue leaders aren&apos;t always margin leaders.</p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Math.round(v / 1000)}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#cbd5e1', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={132}
              tickFormatter={truncateLabel}
            />
            <Tooltip content={<GpTooltip />} cursor={{ fill: 'rgba(74,222,128,0.08)' }} />
            <Bar dataKey="profit" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={entry.color || '#4ade80'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
