'use client';

import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatDateLabel(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

function formatValue(value, format = 'number') {
  const numericValue = Number(value ?? 0);

  if (format === 'currency-compact') {
    return `₪${Math.round(numericValue / 1000)}k`;
  }

  if (format === 'currency') {
    return `₪${numericValue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
  }

  return numericValue.toLocaleString('he-IL');
}

function DefaultTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{formatDateLabel(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: <strong>{formatValue(entry.value, format)}</strong>
        </p>
      ))}
    </div>
  );
}

export default function OverviewTrendChart({
  title,
  description,
  data = [],
  dataKey,
  lineColor = '#4F8CFF',
  valueFormat = 'number',
  footerLink,
  secondaryLines = [],
  noDataMessage,
  activeLabel,
}) {
  // Line vs. Bar toggle — local to each chart instance.
  const [chartType, setChartType] = useState('line');

  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Trend</p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="od-panel-copy">{description}</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>{noDataMessage || 'No data for this period.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">
            Trend
            {activeLabel ? <span className="od-trend-scope-badge">{activeLabel}</span> : null}
          </p>
          <h3>{title}</h3>
        </div>
        <div className="od-chart-toggle" role="group" aria-label="Chart type">
          <button
            type="button"
            className={`od-chart-toggle-btn${chartType === 'line' ? ' is-active' : ''}`}
            onClick={() => setChartType('line')}
            aria-pressed={chartType === 'line'}
          >
            Line
          </button>
          <button
            type="button"
            className={`od-chart-toggle-btn${chartType === 'bar' ? ' is-active' : ''}`}
            onClick={() => setChartType('bar')}
            aria-pressed={chartType === 'bar'}
          >
            Bar
          </button>
        </div>
      </div>
      <p className="od-panel-copy">{description}</p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatValue(value, valueFormat)}
              width={70}
            />
            <Tooltip
              content={<DefaultTooltip format={valueFormat} />}
              cursor={
                chartType === 'bar'
                  ? { fill: 'rgba(79,140,255,0.08)' }
                  : { stroke: 'rgba(79,140,255,0.25)', strokeWidth: 1 }
              }
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {chartType === 'bar' ? (
              <Bar
                dataKey={dataKey}
                name={title}
                fill={lineColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            ) : (
              <Line
                type="monotone"
                dataKey={dataKey}
                name={title}
                stroke={lineColor}
                strokeWidth={3}
                dot={{ r: 2, strokeWidth: 0, fill: lineColor }}
                activeDot={{ r: 5, fill: lineColor }}
              />
            )}
            {secondaryLines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name || line.dataKey}
                stroke={line.color || '#94a3b8'}
                strokeWidth={line.strokeWidth ?? 2}
                strokeDasharray={line.dashed ? '5 3' : undefined}
                dot={false}
                activeDot={{ r: 4, fill: line.color || '#94a3b8' }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
