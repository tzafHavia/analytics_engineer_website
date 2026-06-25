'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TIERS = [
  { key: 'regularHours', name: 'Regular (×1.0)', color: '#4F8CFF' },
  { key: 'ot125Hours', name: 'OT ×1.25', color: '#f59e0b' },
  { key: 'ot150Hours', name: 'OT ×1.5', color: '#ef4444' },
];

function OtTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + Number(p.value || 0), 0);
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label" dir="rtl">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{Number(p.value || 0).toLocaleString('he-IL', { maximumFractionDigits: 1 })}h</strong>
        </p>
      ))}
      <p style={{ color: '#94a3b8' }}>
        Total: <strong>{total.toLocaleString('he-IL', { maximumFractionDigits: 1 })}h</strong>
      </p>
    </div>
  );
}

export default function EmployeeOvertimeChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Labor cost</p>
            <h3>Hours by pay tier</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card"><span>∅</span><p>No workforce data.</p></div>
      </div>
    );
  }

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Labor cost</p>
          <h3>Hours by pay tier</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Regular vs overtime split per employee — overtime hours carry a ×1.25 / ×1.5 premium.
      </p>
      <div className="od-chart-shell">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="employeeName"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
              width={44}
            />
            <Tooltip content={<OtTooltip />} cursor={{ fill: 'rgba(79,140,255,0.08)' }} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            {TIERS.map((tier, i) => (
              <Bar
                key={tier.key}
                dataKey={tier.key}
                name={tier.name}
                stackId="hours"
                fill={tier.color}
                radius={i === TIERS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
