'use client';
import { useState } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const fmtDate = (v) =>
  new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

function HealthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const risk = payload.find((p) => p.dataKey === 'atRisk7dAvg');
  const doc = payload.find((p) => p.dataKey === 'avgDaysOfCover');
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{fmtDate(label)}</p>
      {risk && (
        <p style={{ color: '#f59e0b' }}>
          At-risk (7d avg): <strong>{Number(risk.value).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong>
        </p>
      )}
      {doc && (
        <p style={{ color: '#4F8CFF' }}>
          Avg days of cover: <strong>{Number(doc.value).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong>
        </p>
      )}
    </div>
  );
}

function WowChip({ wowDelta }) {
  if (wowDelta == null) {
    return <span className="inv-wow-chip is-flat">–</span>;
  }
  if (wowDelta > 0) {
    return <span className="inv-wow-chip is-up">▲ +{Number(wowDelta).toLocaleString('en-GB')} vs last week</span>;
  }
  if (wowDelta < 0) {
    return <span className="inv-wow-chip is-down">▼ {Number(wowDelta).toLocaleString('en-GB')} vs last week</span>;
  }
  return <span className="inv-wow-chip is-flat">– 0 vs last week</span>;
}

export default function InventoryHealthTrendChart({ data = [], wowDelta = null }) {
  const [range, setRange] = useState('90');

  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Trend</p>
            <h3>Inventory health over time</h3>
          </div>
        </div>
        <p className="od-panel-copy">
          At-risk items (7-day average) against average days of cover — coverage falling while at-risk rises signals tightening supply.
        </p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No trend data available yet.</p>
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
          <p className="od-panel-kicker">Trend</p>
          <h3>Inventory health over time</h3>
        </div>
        <div className="inv-trend-head-controls">
          <WowChip wowDelta={wowDelta} />
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
      </div>
      <p className="od-panel-copy">
        At-risk items (7-day average) against average days of cover — coverage falling while at-risk rises signals tightening supply.
      </p>
      <p className="od-chart-caption">Rising at-risk is the signal to watch — get ahead of it with reorders.</p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={sliced} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              yAxisId="left"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip content={<HealthTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="atRisk7dAvg"
              name="At-risk (7d avg)"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgDaysOfCover"
              name="Avg days of cover"
              stroke="#4F8CFF"
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="od-faint-note">
        Left axis: at-risk item count (out-of-stock + stockout-risk). Right axis: average days of cover.
      </p>
    </div>
  );
}
