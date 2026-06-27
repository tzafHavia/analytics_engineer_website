'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

// Respect the OS "reduce motion" setting — bars snap in instantly when set.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function HourlyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{formatHour(point.hour)}</p>
      <p style={{ color: '#4F8CFF' }}>
        Sales: <strong>₪{Number(point.sales ?? 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
      </p>
      <p style={{ color: '#00D4AA' }}>
        Tickets: <strong>{Number(point.tickets ?? 0).toLocaleString('he-IL')}</strong>
      </p>
    </div>
  );
}

export default function TestDashHourlyChart({ data = [], switchKey = '' }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="td-chart-panel">
      <div className="td-chart-head">
        <p className="td-chart-kicker">By hour</p>
        <h3 className="td-chart-title">Sales by hour</h3>
      </div>

      {data.length === 0 ? (
        <div className="td-chart-empty">
          <span>∅</span>
          <p>No hourly data for this selection.</p>
        </div>
      ) : (
        <div className="td-chart-shell">
          <ResponsiveContainer key={switchKey} width="100%" height={300}>
            <BarChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="td-hourly-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7db1ff" />
                  <stop offset="50%" stopColor="#2f8bd6" />
                  <stop offset="100%" stopColor="#00C49C" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
              <XAxis
                dataKey="hour"
                tickFormatter={formatHour}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={8}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₪${Math.round(Number(value) / 1000)}k`}
                width={56}
              />
              <Tooltip
                content={<HourlyTooltip />}
                cursor={{ fill: 'rgba(79,140,255,0.10)', radius: 6 }}
              />
              <Bar
                dataKey="sales"
                name="Sales"
                fill="url(#td-hourly-bar)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                /* Studio-grade grow-up: refined ease-out so bars decelerate as
                   they reach full height; the slight begin delay lets the panel
                   entrance land first. key={switchKey} replays this on every
                   filter change — snappy (~760ms) but still graceful. */
                isAnimationActive={!reducedMotion}
                animationBegin={reducedMotion ? 0 : 120}
                animationDuration={reducedMotion ? 0 : 760}
                animationEasing="ease-out"
                /* gentle hover affordance — the hovered bar brightens slightly */
                activeBar={{ fill: 'url(#td-hourly-bar)', fillOpacity: 1, stroke: 'rgba(255,255,255,0.35)', strokeWidth: 1 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
