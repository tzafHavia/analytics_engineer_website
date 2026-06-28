'use client';

import { useMemo, useState } from 'react';
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

function formatNumber(value) {
  return Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

function formatMetric(value, format) {
  if (format === 'currency-compact') {
    return `₪${Math.round(Number(value || 0) / 1000)}k`;
  }

  if (format === 'currency') {
    return formatCurrency(value);
  }

  return formatNumber(value);
}

function truncateLabel(value) {
  if (!value) return '—';
  return value.length > 22 ? `${value.slice(0, 22)}…` : value;
}

function ProductTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{item.itemName}</p>
      <p style={{ color: '#22d3ee' }}>
        {metric.label}: <strong>{formatMetric(item.chartValue, metric.valueFormat)}</strong>
      </p>
      <p style={{ color: '#6366f1' }}>
        Revenue: <strong>{formatCurrency(item.salesAmount30d)}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Units: <strong>{formatNumber(item.soldQty30d || item.unitsSold30d)}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Category: <strong>{item.categoryName || '—'}</strong>
      </p>
    </div>
  );
}

export default function OverviewTopProductsChart({
  data = [],
  footerLink,
  enableCategoryFilter = false,
  metric = {
    key: 'salesAmount30d',
    label: 'Revenue',
    heading: 'Top 10 products by sales',
    description: 'Revenue leaders ordered by rolling 30-day sales amount.',
    valueFormat: 'currency-compact',
  },
}) {
  const [selectedCategory, setSelectedCategory] = useState('');

  // Distinct categories present in the data rows (only used when the filter is on).
  const categories = useMemo(() => {
    if (!enableCategoryFilter) return [];
    const set = new Set();
    data.forEach((item) => {
      if (item.categoryName) set.add(item.categoryName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [data, enableCategoryFilter]);

  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Products</p>
            <h3>{metric.heading}</h3>
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

  // When the category filter is enabled, filter → re-sort by metric desc → top 10.
  // With "All" (or filter disabled) we keep the incoming order and cap at 10.
  const sourceRows = enableCategoryFilter && selectedCategory
    ? data.filter((item) => item.categoryName === selectedCategory)
    : data;

  const chartData = sourceRows
    .map((item) => ({ ...item, chartValue: Number(item[metric.key] || 0) }))
    .sort((a, b) => b.chartValue - a.chartValue)
    .slice(0, 10);

  return (
    <div className="od-panel" id="overview-top-products">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Products</p>
          <h3>{metric.heading}</h3>
        </div>
        {enableCategoryFilter && categories.length > 0 ? (
          <label className="od-filter-field od-filter-field--inline od-chart-filter">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : footerLink ? (
          <a href={footerLink.href} className="od-inline-link">
            {footerLink.label}
          </a>
        ) : null}
      </div>
      <p className="od-panel-copy">{metric.description}</p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatMetric(value, metric.valueFormat)}
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
            <Tooltip content={<ProductTooltip metric={metric} />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
            <Bar dataKey="chartValue" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`${entry.itemId}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}