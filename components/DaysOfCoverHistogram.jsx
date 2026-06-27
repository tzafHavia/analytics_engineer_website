'use client';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

const BUCKET_COLORS = {
  '0–7d':   '#ef4444',
  '7–14d':  '#f59e0b',
  '14–30d': '#22d3ee',
  '30d+':   '#4ade80',
  'No data': '#475569',
};

function HistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { bucket, count } = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{bucket}</p>
      <p style={{ color: payload[0].fill }}>
        Products: <strong>{count}</strong>
      </p>
    </div>
  );
}

export default function DaysOfCoverHistogram({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Coverage</p>
            <h3>Days of cover distribution</h3>
          </div>
        </div>
        <p className="od-panel-copy">Stock coverage buckets based on 30-day sales pace.</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No coverage data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Coverage</p>
          <h3>Days of cover distribution</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Products bucketed by how many days of stock remain at the current 30-day sales pace.
        Red = urgent risk, green = well covered.
      </p>
      <p className="od-chart-caption">Left tail flags reorders; the long right tail is tied-up cash.</p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="bucket"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<HistTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <Bar dataKey="count" name="Products" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.bucket}
                  fill={BUCKET_COLORS[entry.bucket] || '#6366f1'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
