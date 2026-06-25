'use client';

import { useState, useRef, useLayoutEffect, useEffect } from 'react';

// Match the CSS rise/value-fade durations so timers stay in sync.
const GLIDE_MS = 500;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatHours(value) {
  return `${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}h`;
}

// Metric → ranking key + headline value/caption resolver.
const METRICS = {
  sales: {
    label: 'Sales',
    rankKey: 'salesRank',
    headline: (e) => formatCurrency(e.attributedSales),
    caption: 'attributed sales',
  },
  hours: {
    label: 'Hours',
    rankKey: 'hoursRank',
    headline: (e) => formatHours(e.totalHours),
    caption: 'total hours',
  },
  efficiency: {
    label: 'Efficiency',
    rankKey: 'efficiencyRank',
    headline: (e) => `₪${Number(e.salesPerLaborShekel || 0).toFixed(2)}`,
    caption: 'per ₪1 labor',
  },
};

// Visual podium order keyed by podium position (1=center/tall, 2=left, 3=right).
// `order` drives the flex placement; the CSS handles the elevation offset.
const PODIUM_ORDER = { 1: 2, 2: 1, 3: 3 };
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const TIERS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export default function WorkforceScorecard({ employees = [] }) {
  const [metric, setMetric] = useState('sales');
  // Cards animate in only on first mount; the entrance class is dropped after.
  const [entered, setEntered] = useState(false);

  // FLIP reorder: remember each card's screen x by employeeId across renders.
  const cardRefs = useRef(new Map());        // employeeId -> HTMLElement
  const prevRects = useRef(new Map());        // employeeId -> {x}
  const reorderArmed = useRef(false);         // only run FLIP on a metric change

  // Drop the entrance class once the rise has played (or immediately if reduced).
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), prefersReducedMotion() ? 0 : 1100);
    return () => clearTimeout(t);
  }, []);

  // FLIP: when `metric` (hence DOM order via `order`) changes, glide each card
  // from its previous x to its new x. Reads happen before paint in useLayoutEffect.
  useLayoutEffect(() => {
    if (!reorderArmed.current) return;        // skip the very first render
    if (prefersReducedMotion()) return;       // honour reduced-motion: snap

    const moved = [];
    cardRefs.current.forEach((el, id) => {
      if (!el) return;
      const next = el.getBoundingClientRect();
      const prev = prevRects.current.get(id);
      if (!prev) return;
      const dx = prev.x - next.x;
      if (Math.abs(dx) < 1) return;
      // Invert: place the card at its old spot, then release to glide home.
      el.classList.remove('is-playing');
      el.classList.add('wf-podium-glide');
      el.style.setProperty('--wf-flip-x', `${dx}px`);
      moved.push(el);
    });

    if (!moved.length) return;
    // Next frame: clear the inverted offset and let the CSS transition run.
    const raf = requestAnimationFrame(() => {
      moved.forEach((el) => el.classList.add('is-playing'));
    });
    const t = setTimeout(() => {
      moved.forEach((el) => {
        el.classList.remove('wf-podium-glide', 'is-playing');
        el.style.removeProperty('--wf-flip-x');
      });
    }, GLIDE_MS + 40);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [metric]);

  if (!employees.length) return null;

  const cfg = METRICS[metric];

  // Sort a copy by the selected metric's rank (1 = best). DOM order = rank order
  // for a11y; CSS `order` re-positions to the 2-1-3 podium silhouette.
  const ranked = [...employees].sort((a, b) => a[cfg.rankKey] - b[cfg.rankKey]);

  // Capture current positions BEFORE the re-render that the metric switch will
  // cause, so the post-render useLayoutEffect can compute the delta.
  const captureRects = () => {
    prevRects.current.clear();
    cardRefs.current.forEach((el, id) => {
      if (el) prevRects.current.set(id, { x: el.getBoundingClientRect().x });
    });
  };

  const handleMetric = (key) => {
    if (key === metric) return;
    captureRects();
    reorderArmed.current = true;
    setMetric(key);
  };

  return (
    <div className="wf-podium">
      {/* Keyframes live here (not in globals.css — Turbopack drops @keyframes). */}
      <style>{`
        @keyframes wf-podium-shimmer {
          0%        { transform: translateX(-130%); }
          55%, 100% { transform: translateX(130%); }
        }
        @keyframes wf-podium-rise {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes wf-podium-value-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      {/* ── Metric selector ─────────────────────────────────────────────── */}
      <div className="wf-podium-controls">
        <span className="wf-podium-controls-label">Rank by</span>
        <div className="wf-podium-seg" role="tablist" aria-label="Podium ranking metric">
          {Object.entries(METRICS).map(([key, m]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={metric === key}
              className={`wf-podium-seg-btn${metric === key ? ' is-active' : ''}`}
              onClick={() => handleMetric(key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Podium row ──────────────────────────────────────────────────── */}
      <div className="wf-podium-row">
        {ranked.map((e, idx) => {
          const position = idx + 1; // 1 = best for the selected metric
          const tier = TIERS[position] || 'bronze';
          const otHours = (e.ot125Hours || 0) + (e.ot150Hours || 0);
          const otShare = e.totalHours > 0 ? (otHours / e.totalHours) * 100 : 0;
          const regPct = e.totalHours > 0 ? (e.regularHours / e.totalHours) * 100 : 0;
          const ot125Pct = e.totalHours > 0 ? (e.ot125Hours / e.totalHours) * 100 : 0;
          const ot150Pct = e.totalHours > 0 ? (e.ot150Hours / e.totalHours) * 100 : 0;

          // Secondary stats: show the ones that AREN'T the current headline.
          const secondary = [];
          if (metric !== 'sales') {
            secondary.push({ label: 'Attributed sales', value: formatCurrency(e.attributedSales) });
          }
          if (metric !== 'efficiency') {
            secondary.push({ label: 'Efficiency (₪/₪)', value: `₪${Number(e.salesPerLaborShekel || 0).toFixed(2)}` });
          }
          secondary.push({ label: 'Total pay', value: formatCurrency(e.totalPay) });
          secondary.push({ label: 'Recent form (7d)', value: `${formatCurrency(e.avgDailySales7d)}/d` });

          // Entrance: stagger by podium position so the gold (1st) settles
          // LAST — a build-up to the winner. Shimmer staggers by tier so the
          // three cards never sweep in unison; gold leads as the headliner.
          const riseDelay = { 1: 320, 2: 0, 3: 160 }[position] ?? 0;
          const shimmerDelay = { gold: 0, silver: 1200, bronze: 2400 }[tier] ?? 0;

          return (
            <article
              key={e.employeeId}
              ref={(el) => {
                if (el) cardRefs.current.set(e.employeeId, el);
                else cardRefs.current.delete(e.employeeId);
              }}
              className={`wf-podium-card wf-podium-${tier}${entered ? '' : ' wf-podium-enter'}`}
              data-position={position}
              style={{
                order: PODIUM_ORDER[position] ?? position,
                '--wf-rise-delay': `${riseDelay}ms`,
                '--wf-shimmer-delay': `${shimmerDelay}ms`,
              }}
            >
              {/* shimmer hook: animator's metallic sheen strip (keyframes inline) */}
              <span className="wf-podium-shimmer" aria-hidden />
              <div className="wf-podium-medal" aria-hidden>{MEDALS[position]}</div>

              <div className="wf-podium-identity">
                <span className="wf-podium-avatar" aria-hidden>🧑‍💼</span>
                <span className="wf-podium-name" dir="rtl">{e.employeeName}</span>
              </div>

              <div className="wf-podium-headline">
                <span className="wf-podium-headline-value" key={metric}>{cfg.headline(e)}</span>
                <span className="wf-podium-headline-caption">{cfg.caption}</span>
              </div>

              <div className="wf-podium-chips">
                {e.salesRank === 1 && <span className="wf-rank-chip">#1 sales</span>}
                {e.hoursRank === 1 && <span className="wf-rank-chip">#1 hours</span>}
                {e.efficiencyRank === 1 && <span className="wf-rank-chip">#1 efficiency</span>}
              </div>

              <div className="wf-podium-stats">
                {secondary.map((s) => (
                  <div className="wf-podium-stat" key={s.label}>
                    <span className="wf-podium-stat-label">{s.label}</span>
                    <span className="wf-podium-stat-value">{s.value}</span>
                  </div>
                ))}
              </div>

              <div className="wf-podium-hours">
                <div
                  className="wf-podium-hours-bar"
                  role="img"
                  aria-label={`${formatHours(e.totalHours)} total, ${otShare.toFixed(0)}% overtime`}
                >
                  <span className="wf-podium-hours-seg wf-podium-hours-reg" style={{ width: `${regPct}%` }} />
                  <span className="wf-podium-hours-seg wf-podium-hours-ot125" style={{ width: `${ot125Pct}%` }} />
                  <span className="wf-podium-hours-seg wf-podium-hours-ot150" style={{ width: `${ot150Pct}%` }} />
                </div>
                <p className="wf-podium-hours-caption">
                  {formatHours(e.totalHours)} · {otShare.toFixed(0)}% overtime
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
