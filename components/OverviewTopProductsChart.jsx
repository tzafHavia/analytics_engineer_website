'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const BAR_COLORS = ['#6366f1', '#22d3ee', '#4ade80', '#fb923c', '#ec4899'];

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function truncateLabel(value) {
  if (!value) return '—';
  return value.length > 22 ? `${value.slice(0, 22)}…` : value;
}

function ProductTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{item.itemName}</p>
      <p style={{ color: '#6366f1' }}>
        Revenue: <strong>{formatCurrency(item.salesAmount30d)}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Units: <strong>{item.unitsSold30d.toLocaleString('he-IL')}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Category: <strong>{item.categoryName || '—'}</strong>
      </p>
    </div>
  );
}

export default function OverviewTopProductsChart({ data = [], footerLink }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Products</p>
            <h3>Top 10 products by sales</h3>
          </div>
        </div>
        <p className="od-panel-copy">Best-selling products across the latest rolling 30-day view.</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No product ranking data returned.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="od-panel" id="overview-top-products">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Products</p>
          <h3>Top 10 products by sales</h3>
        </div>
        {footerLink ? (
          <a href={footerLink.href} className="od-inline-link">
            {footerLink.label}
          </a>
        ) : null}
      </div>
      <p className="od-panel-copy">Revenue leaders ordered by rolling 30-day sales amount.</p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `₪${Math.round(Number(value) / 1000)}k`}
            />
            <YAxis
              type="category"
              dataKey="itemName"
              tick={{ fill: '#cbd5e1', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={132}
              tickFormatter={truncateLabel}
            />
            <Tooltip content={<ProductTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <Bar dataKey="salesAmount30d" radius={[0, 6, 6, 0]}>
              {data.map((entry, index) => (
                <Cell key={`${entry.itemId}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}