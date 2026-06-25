'use client';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const fmtDate = (v) =>
  new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const SERIES = [
  { key: 'healthy', name: 'Healthy', color: '#00D4AA' },
  { key: 'overstock', name: 'Overstock', color: '#22c55e' },
  { key: 'deadStock', name: 'Dead stock', color: '#94a3b8' },
  { key: 'stockoutRisk', name: 'Stockout risk', color: '#f59e0b' },
  { key: 'outOfStock', name: 'Out of stock', color: '#ef4444' },
];

function CompositionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{fmtDate(label)}</p>
      {[...payload].reverse().map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{Number(p.value).toLocaleString('en-GB')}</strong>
        </p>
      ))}
    </div>
  );
}

export default function InventoryStatusCompositionChart({ data = [] }) {
  const [range, setRange] = useState('90');

  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Composition</p>
            <h3>Stock status mix over time</h3>
          </div>
        </div>
        <p className="od-panel-copy">How the tracked SKU base splits across stock-health bands over time.</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No composition data available yet.</p>
        </div>
      </div>
    );
  }

  const sliced =
    range === 'all' ? data
    : range === '30' ? data.slice(-30)
    : data.slice(-90);

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Composition</p>
          <h3>Stock status mix over time</h3>
        </div>
        <div className="inv-trend-range" role="group" aria-label="Trend range">
          <button
            type="button"
            className={`inv-trend-range-btn${range === '30' ? ' is-active' : ''}`}
            onClick={() => setRange('30')}
          >30d</button>
          <button
            type="button"
            className={`inv-trend-range-btn${range === '90' ? ' is-active' : ''}`}
            onClick={() => setRange('90')}
          >90d</button>
          <button
            type="button"
            className={`inv-trend-range-btn${range === 'all' ? ' is-active' : ''}`}
            onClick={() => setRange('all')}
          >All</button>
        </div>
      </div>
      <p className="od-panel-copy">
        How the tracked SKU base splits across stock-health bands over time.
      </p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={sliced} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={fmtDate}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CompositionTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId="status"
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.75}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
