'use client';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';

const VELOCITY_COLORS = {
  FAST:            '#4ade80',
  STEADY:          '#22d3ee',
  SLOW:            '#f59e0b',
  NO_RECENT_SALES: '#94a3b8',
  OUT_OF_STOCK:    '#ef4444',
};
const VELOCITY_ORDER = ['FAST', 'STEADY', 'SLOW', 'NO_RECENT_SALES', 'OUT_OF_STOCK'];

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{d.itemName}</p>
      <p style={{ color: '#94a3b8' }}>{d.categoryName}</p>
      <p style={{ color: '#22d3ee' }}>
        Sales: <strong>₪{Number(d.salesAmount || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#4ade80' }}>
        Est. GP: <strong>₪{Number(d.grossProfit || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
    </div>
  );
}

export default function ProductScatterChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Analysis</p>
            <h3>Sales vs. gross profit by product</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No product data available.</p>
        </div>
      </div>
    );
  }

  const grouped = VELOCITY_ORDER.reduce((acc, band) => {
    acc[band] = data.filter(d => d.velocityBand === band);
    return acc;
  }, {});

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Analysis · Top 100 products by revenue</p>
          <h3>Sales vs. gross profit</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Each dot = one product. X = 30-day revenue, Y = estimated gross profit. Coloured by velocity band.
      </p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 10, right: 24, left: 4, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
            <XAxis
              type="number"
              dataKey="salesAmount"
              name="Sales"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Math.round(v / 1000)}k`}
              label={{ value: '30d sales (₪)', position: 'insideBottomRight', offset: -4, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="grossProfit"
              name="GP"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Math.round(v / 1000)}k`}
              width={64}
              label={{ value: 'Est. GP (₪)', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 11 }}
            />
            <ZAxis range={[36, 36]} />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            {VELOCITY_ORDER.map(band =>
              grouped[band].length > 0 ? (
                <Scatter
                  key={band}
                  name={band === 'NO_RECENT_SALES' ? 'No recent sales'
                       : band === 'OUT_OF_STOCK' ? 'Out of stock'
                       : band.charAt(0) + band.slice(1).toLowerCase()}
                  data={grouped[band]}
                  fill={VELOCITY_COLORS[band]}
                  fillOpacity={0.75}
                />
              ) : null
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="inv-scatter-legend">
        {VELOCITY_ORDER.map(band => (
          <span key={band} style={{ color: VELOCITY_COLORS[band], fontSize: '0.8rem' }}>
            ■ {band === 'NO_RECENT_SALES' ? 'No recent sales'
               : band === 'OUT_OF_STOCK' ? 'Out of stock'
               : band.charAt(0) + band.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
