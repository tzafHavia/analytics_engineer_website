'use client';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

function TreeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{item.name}</p>
      <p style={{ color: '#22d3ee' }}>
        Sales: <strong>₪{Number(item.value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#4ade80' }}>
        Est. GP: <strong>₪{Number(item.profit || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Units sold: <strong>{Number(item.unitsSold || 0).toLocaleString('he-IL')}</strong>
      </p>
    </div>
  );
}

function TreemapContent(props) {
  const { x, y, width, height, name, value, profit, color, root } = props;
  if (!width || !height || width < 18 || height < 18) return null;

  const total = root?.value || 1;
  const pct = ((value / total) * 100).toFixed(1);
  const showName = width > 48 && height > 26;
  const showPct = width > 56 && height > 44;
  const fontSize = Math.min(12, Math.max(9, Math.floor(width / 9)));

  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        fill={color || '#6366f1'}
        fillOpacity={0.82}
        stroke="rgba(8,11,20,0.5)"
        strokeWidth={1.5}
        rx={3} ry={3}
      />
      {showName && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPct ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={fontSize}
          fontWeight={600}
        >
          {name && name.length > 14 ? name.slice(0, 12) + '…' : (name || '')}
        </text>
      )}
      {showPct && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.68)"
          fontSize={10}
        >
          {pct}%
        </text>
      )}
    </g>
  );
}

export default function CategoryTreemap({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Categories</p>
            <h3>Category revenue share</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No category data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Categories · Rolling 30d</p>
          <h3>Category revenue share</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Tile area = 30-day sales share. Hover for revenue and estimated gross profit.
      </p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={340}>
          <Treemap
            data={data}
            dataKey="value"
            nameKey="name"
            content={<TreemapContent />}
          >
            <Tooltip content={<TreeTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
