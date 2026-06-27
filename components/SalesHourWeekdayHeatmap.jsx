'use client';
import { useState } from 'react';

const DAY_ORDER = [
  { idx: 0, label: 'Sun' },
  { idx: 1, label: 'Mon' },
  { idx: 2, label: 'Tue' },
  { idx: 3, label: 'Wed' },
  { idx: 4, label: 'Thu' },
  { idx: 5, label: 'Fri' },
  { idx: 6, label: 'Sat' },
];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Sequential ramp: faint slate → strong teal/blue.
function cellColor(t) {
  // t in [0,1]. Interpolate from faint to teal-blue.
  if (t <= 0) return 'rgba(148,163,184,0.07)';
  // Two-stop ramp: teal (#00D4AA) at low-mid → blue (#4F8CFF) at high.
  const lerp = (a, b, k) => Math.round(a + (b - a) * k);
  // base faint teal at t→0+, strong blue at t→1
  const r = lerp(28, 79, t);
  const g = lerp(160, 140, t);
  const b = lerp(150, 255, t);
  const alpha = 0.18 + 0.78 * t;
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function fmtCurrency(v) {
  return `₪${Number(v || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

export default function SalesHourWeekdayHeatmap({ data = [] }) {
  const [hover, setHover] = useState(null);

  if (!data.length) {
    return (
      <div className="od-panel od-panel-empty">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Timing · Full history</p>
            <h3>Sales heatmap — hour × weekday</h3>
          </div>
        </div>
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No heatmap data available.</p>
        </div>
      </div>
    );
  }

  // Index by `${dayOfWeek}-${hour}` using avgPerOccurrence as intensity.
  const cells = new Map();
  let maxVal = 0;
  for (const row of data) {
    const key = `${row.dayOfWeek}-${row.hour}`;
    cells.set(key, row);
    const v = Number(row.avgPerOccurrence || 0);
    if (v > maxVal) maxVal = v;
  }
  const safeMax = maxVal > 0 ? maxVal : 1;

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Timing · Full history</p>
          <h3>Sales heatmap — hour × weekday</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Average net sales for a typical day-and-hour slot across the full history
        (e.g. a &ldquo;typical Friday 14:00&rdquo;). Darker = busier.
      </p>
      <p className="od-chart-caption">Busiest late morning to mid-afternoon — staff accordingly.</p>

      <div className="sales-heatmap-wrap">
        <div className="sales-heatmap-grid" role="img" aria-label="Sales heatmap by hour and weekday">
          {/* corner spacer */}
          <div className="sales-heatmap-corner" />
          {/* hour column headers */}
          {HOURS.map((h) => (
            <div key={`hh-${h}`} className="sales-heatmap-colhead">
              {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}

          {/* one row per weekday */}
          {DAY_ORDER.map((day) => (
            <div key={`row-${day.idx}`} className="sales-heatmap-row" style={{ display: 'contents' }}>
              <div className="sales-heatmap-rowhead">{day.label}</div>
              {HOURS.map((h) => {
                const row = cells.get(`${day.idx}-${h}`);
                const v = Number(row?.avgPerOccurrence || 0);
                const t = v / safeMax;
                const isHover = hover && hover.day === day.idx && hover.hour === h;
                return (
                  <div
                    key={`c-${day.idx}-${h}`}
                    className="sales-heatmap-cell"
                    style={{
                      backgroundColor: cellColor(t),
                      outline: isHover ? '1px solid rgba(255,255,255,0.85)' : 'none',
                    }}
                    title={
                      row
                        ? `${day.label} ${String(h).padStart(2, '0')}:00 — typical ${fmtCurrency(v)} · ${Number(row.tickets || 0).toLocaleString('he-IL')} tickets over ${Number(row.occurrences || 0)} days`
                        : `${day.label} ${String(h).padStart(2, '0')}:00 — no sales`
                    }
                    onMouseEnter={() => setHover({ day: day.idx, hour: h, row, label: day.label })}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* hover readout */}
      <div className="sales-heatmap-readout">
        {hover && hover.row ? (
          <span>
            <strong>{hover.label} {String(hover.hour).padStart(2, '0')}:00</strong>
            {' · typical '}
            <strong style={{ color: '#00D4AA' }}>{fmtCurrency(hover.row.avgPerOccurrence)}</strong>
            {' · '}{Number(hover.row.tickets || 0).toLocaleString('he-IL')} tickets
            {' over '}{Number(hover.row.occurrences || 0)} days
          </span>
        ) : (
          <span className="od-faint-note">Hover a cell for the typical-day average.</span>
        )}
      </div>

      {/* legend */}
      <div className="sales-heatmap-legend">
        <span className="od-faint-note">Low</span>
        <span className="sales-heatmap-legend-bar" />
        <span className="od-faint-note">High ({fmtCurrency(safeMax)})</span>
      </div>
    </div>
  );
}
