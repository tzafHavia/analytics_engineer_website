'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function HoursTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label" dir="rtl">{d.name}</p>
      <p style={{ color: '#00D4AA' }}>
        Hours: <strong>{Number(d.hours || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}h</strong>
      </p>
    </div>
  );
}

// Horizontal bar of total worked hours per employee (all-time summary).
// Employee names are Hebrew → rendered RTL.
export default function CaseStudyEmployeeHoursChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="table-empty od-empty-card">
        <span>∅</span>
        <p>No workforce data available.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Number((v / 1000).toFixed(1))}k h`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fill: '#94a3b8', fontSize: 12, direction: 'rtl' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<HoursTooltip />} cursor={{ fill: 'rgba(0,212,170,0.08)' }} />
        <Bar dataKey="hours" name="Hours" fill="#00D4AA" radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
