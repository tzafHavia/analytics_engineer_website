'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

function PaymentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{item.label}</p>
      <p style={{ color: item.color }}>
        Sales: <strong>₪{Number(item.value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Share: <strong>{Number(item.share || 0).toFixed(1)}%</strong>
      </p>
    </div>
  );
}

export default function PaymentMixDonut({ data = [], periodLabel }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Payments</p>
            <h3>Payment method mix</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No payment data for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Payments · {periodLabel || 'Selected period'}</p>
          <h3>Payment method mix</h3>
        </div>
      </div>
      <p className="od-panel-copy">Credit vs. cash split by sales amount for the selected period.</p>
      <div className="od-donut-layout">
        <div className="od-chart-shell od-chart-shell-donut">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={52}
                outerRadius={82}
                paddingAngle={3}
                stroke="rgba(8,11,20,0.4)"
                strokeWidth={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PaymentTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="od-legend-list">
          {data.map((item) => (
            <div key={item.key} className="od-legend-item">
              <span className="od-legend-dot" style={{ backgroundColor: item.color }} />
              <div>
                <p className="od-legend-label">{item.label}</p>
                <p className="od-legend-value">{item.share.toFixed(1)}% of sales</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
