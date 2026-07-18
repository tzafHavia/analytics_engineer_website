'use client';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#4F8CFF', '#00D4AA', '#A855F7', '#f59e0b', '#22d3ee', '#4ade80'];

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label" dir="rtl">{d.name}</p>
      <p style={{ color: d.payload.fill }}>
        Revenue: <strong>₪{Number(d.value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
    </div>
  );
}

// Donut of 30-day revenue contribution by category (top 6, live).
// Category names are Hebrew → rendered RTL in tooltip/legend.
export default function CaseStudyCategoryChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="table-empty od-empty-card">
        <span>∅</span>
        <p>No category data available.</p>
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CategoryTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="inv-scatter-legend" style={{ justifyContent: 'center' }}>
        {data.map((d, i) => (
          <span key={d.name} dir="rtl" style={{ color: COLORS[i % COLORS.length], fontSize: '0.78rem' }}>
            ■ {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}
