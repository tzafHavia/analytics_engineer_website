'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_COLORS = {
  OUT_OF_STOCK: '#ef4444',
  STOCKOUT_RISK: '#f59e0b',
  OVERSTOCK: '#22c55e',
  DEAD_STOCK: '#94a3b8',
};

function InventoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{item.label}</p>
      <p style={{ color: item.color }}>
        Items: <strong>{Number(item.value || 0).toLocaleString('he-IL')}</strong>
      </p>
    </div>
  );
}

export default function InventoryStatusDonut({ data = [], footerLink }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Inventory</p>
            <h3>Stock status distribution</h3>
          </div>
        </div>
        <p className="od-panel-copy">Latest inventory snapshot grouped by stock status.</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No inventory snapshot data returned.</p>
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    color: STATUS_COLORS[item.key] || '#6366f1',
  }));

  return (
    <div className="od-panel" id="inventory-mix">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Inventory</p>
          <h3>Stock status distribution</h3>
        </div>
        {footerLink ? (
          <a href={footerLink.href} className="od-inline-link">
            {footerLink.label}
          </a>
        ) : null}
      </div>
      <p className="od-panel-copy">Latest inventory snapshot mix, highlighting stock risk and excess inventory concentration.</p>
      <div className="od-donut-layout">
        <div className="od-chart-shell od-chart-shell-donut">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                innerRadius={62}
                outerRadius={98}
                paddingAngle={3}
                stroke="rgba(8,11,20,0.4)"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<InventoryTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="od-legend-list">
          {chartData.map((item) => (
            <div key={item.key} className="od-legend-item">
              <span className="od-legend-dot" style={{ backgroundColor: item.color }} />
              <div>
                <p className="od-legend-label">{item.label}</p>
                <p className="od-legend-value">{item.value.toLocaleString('he-IL')} items</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}