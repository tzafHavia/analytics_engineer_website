'use client';
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';

const VELOCITY_COLORS = {
  FAST:            '#4ade80',
  STEADY:          '#22d3ee',
  SLOW:            '#f59e0b',
  NO_RECENT_SALES: '#94a3b8',
  OUT_OF_STOCK:    '#ef4444',
};

const VELOCITY_LABELS = {
  FAST:            'Fast mover',
  STEADY:          'Steady mover',
  SLOW:            'Slow mover',
  NO_RECENT_SALES: 'No recent sales',
  OUT_OF_STOCK:    'Out of stock',
};

const VELOCITY_ORDER = ['FAST', 'STEADY', 'SLOW', 'NO_RECENT_SALES', 'OUT_OF_STOCK'];

function ScatterTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const color = VELOCITY_COLORS[d.velocityBand] || VELOCITY_COLORS[d.velocityBand?.toUpperCase()] || '#6366f1';
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{d.itemName}</p>
      <p style={{ color: '#94a3b8', fontSize: '0.78rem', marginBottom: '0.3rem' }}>{d.categoryName}</p>
      <p>Inventory: <strong>{Number(d.inventoryQty ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong></p>
      <p>Sold (30d): <strong>{Number(d.soldQty30d ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong></p>
      {d.daysOfCover30d != null && (
        <p>Days of cover: <strong>{Number(d.daysOfCover30d).toFixed(1)}d</strong></p>
      )}
      <p style={{ color, fontSize: '0.78rem', marginTop: '0.2rem' }}>
        {VELOCITY_LABELS[d.velocityBand] || d.velocityBand}
      </p>
    </div>
  );
}

export default function InventoryScatterChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Inventory vs Sales</p>
            <h3>Inventory quantity vs sold units (30d)</h3>
          </div>
        </div>
        <p className="od-panel-copy">Each dot is a product — coloured by velocity band.</p>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No scatter data available.</p>
        </div>
      </div>
    );
  }

  const grouped = VELOCITY_ORDER.reduce((acc, band) => {
    acc[band] = data.filter(d => d.velocityBand === band);
    return acc;
  }, {});
  const presentBands = VELOCITY_ORDER.filter(band => grouped[band].length > 0);

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Inventory vs Sales</p>
          <h3>Inventory quantity vs sold units (30d)</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Each dot is a product. X = units sold in 30 days · Y = current on-hand stock.
        Top-left = overstocked; bottom-right = high-velocity with low cover.
      </p>
      <p className="od-chart-caption">Bottom-right needs reordering; top-left is overstock to work down.</p>
      <div className="od-chart-shell od-chart-shell-tall od-quadrant-shell">
        <span className="od-quadrant-label od-quadrant-tl">Overstocked · slow off the shelf</span>
        <span className="od-quadrant-label od-quadrant-tr">High stock / high velocity · healthy</span>
        <span className="od-quadrant-label od-quadrant-bl">Low stock / low velocity · trim</span>
        <span className="od-quadrant-label od-quadrant-br">Reorder · selling faster than cover</span>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 10, right: 20, left: 4, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
            <XAxis
              dataKey="soldQty30d"
              name="Sold 30d"
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Units sold (30d)', position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              dataKey="inventoryQty"
              name="On-hand"
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={58}
            />
            <ZAxis range={[36, 36]} />
            <Tooltip content={<ScatterTooltipContent />} cursor={{ strokeDasharray: '3 3', stroke: 'rgba(99,102,241,0.3)' }} />
            {presentBands.map(band => (
              <Scatter
                key={band}
                name={VELOCITY_LABELS[band] || band}
                data={grouped[band]}
                fill={VELOCITY_COLORS[band]}
                fillOpacity={0.72}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="inv-scatter-legend">
        {presentBands.map(band => (
          <div key={band} className="od-legend-item">
            <span className="od-legend-dot" style={{ backgroundColor: VELOCITY_COLORS[band] }} />
            <p className="od-legend-label">{VELOCITY_LABELS[band]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
