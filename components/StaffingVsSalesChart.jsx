'use client';
import {
  Bar, Cell, ComposedChart, CartesianGrid, Line, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const SALES_COLOR = '#4F8CFF';      // blue
const UNSTAFFED_COLOR = '#A855F7';  // analytics purple — flags unstaffed trading
const LABOUR_COLOR = '#00D4AA';     // teal

// "Unstaffed trading": sales rang but little/no labour punched in.
function isUnstaffed(d) {
  return Number(d.netSales || 0) > 0 &&
    (d.salesPerLabourHour == null || Number(d.labourHours || 0) < 0.5);
}

function StaffingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const unstaffed = isUnstaffed(d);
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{String(d.hour).padStart(2, '0')}:00</p>
      <p style={{ color: SALES_COLOR }}>
        Net sales: <strong>₪{Number(d.netSales || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: LABOUR_COLOR }}>
        Labour hours: <strong>{Number(d.labourHours || 0).toLocaleString('he-IL', { maximumFractionDigits: 1 })}h</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Avg headcount: <strong>{Number(d.headcountAvg || 0).toLocaleString('he-IL', { maximumFractionDigits: 1 })}</strong>
      </p>
      <p style={{ color: '#94a3b8' }}>
        Sales / labour hr: <strong>
          {d.salesPerLabourHour == null
            ? '—'
            : `₪${Number(d.salesPerLabourHour).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
        </strong>
      </p>
      {unstaffed && (
        <p style={{ color: UNSTAFFED_COLOR, marginTop: '0.2rem' }}>
          ⚠ Unstaffed trading
        </p>
      )}
    </div>
  );
}

export default function StaffingVsSalesChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Coverage</p>
            <h3>Staffing vs sales by hour</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card"><span>∅</span><p>No staffing data.</p></div>
      </div>
    );
  }

  // Ensure full 0–23 ordering.
  const byHour = new Map(data.map((d) => [Number(d.hour), d]));
  const rows = Array.from({ length: 24 }, (_, h) => byHour.get(h) || {
    hour: h, labourHours: 0, headcountAvg: 0, netSales: 0, tickets: 0, salesPerLabourHour: null,
  });

  const unstaffedHours = rows.filter(isUnstaffed).map((d) => d.hour);
  const hasUnstaffed = unstaffedHours.length > 0;

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Coverage</p>
          <h3>Staffing vs sales by hour</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Bars = net sales by hour · line = labour hours punched in. Purple bars flag
        <strong style={{ color: UNSTAFFED_COLOR }}> unstaffed trading</strong> — hours that
        ring sales with little or no staff clocked in.
      </p>
      <p className="od-chart-caption">Overnight hours ring sales with little or no staff on shift.</p>
      <p className="od-faint-note" style={{ marginTop: '-0.3rem', marginBottom: '0.4rem' }}>
        <span
          className="od-info-badge"
          aria-hidden="true"
          title="Labour hours are allocated by minute-precise shift overlap, so mid-afternoon shift change-overs and breaks make some hours (e.g. 14:00–16:00) slightly higher or lower."
        >
          i
        </span>
        Labour hours are allocated by minute-precise shift overlap — change-overs and breaks
        (e.g. around 14:00–16:00) nudge some hours slightly up or down.
      </p>
      <div className="od-chart-shell od-chart-shell-tall">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={(v) => String(v).padStart(2, '0')}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              yAxisId="sales"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `₪${Number((v / 1000).toFixed(1))}k`}
              width={52}
            />
            <YAxis
              yAxisId="labour"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
              width={44}
            />
            <Tooltip content={<StaffingTooltip />} cursor={{ fill: 'rgba(79,140,255,0.08)' }} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            <Bar yAxisId="sales" dataKey="netSales" name="Net sales" radius={[3, 3, 0, 0]}>
              {rows.map((d) => (
                <Cell key={`c-${d.hour}`} fill={isUnstaffed(d) ? UNSTAFFED_COLOR : SALES_COLOR} />
              ))}
            </Bar>
            <Line
              yAxisId="labour"
              type="monotone"
              dataKey="labourHours"
              name="Labour hours"
              stroke={LABOUR_COLOR}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: LABOUR_COLOR }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {hasUnstaffed && (
        <p className="od-faint-note" style={{ marginTop: '0.6rem' }}>
          <span style={{ color: UNSTAFFED_COLOR }}>■</span>{' '}
          Overnight hours ({unstaffedHours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ')})
          ring sales with little/no staff punched in.
        </p>
      )}
    </div>
  );
}
