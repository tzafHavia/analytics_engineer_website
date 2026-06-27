'use client';

import { useEffect, useRef, useState } from 'react';

// Animated count-up: eases from 0 → value over ~1.1s.
// `replayKey` is a dependency that, when bumped, restarts the animation from 0.
function useCountUp(target, replayKey = 0, duration = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) {
      setValue(0);
      return;
    }

    let raf;
    const t0 = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    setValue(0);
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setValue(end * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, replayKey, duration]);

  return value;
}

function formatValue(value, format) {
  const n = Number(value) || 0;
  if (format === 'currency') {
    return `₪${Math.round(n).toLocaleString('he-IL')}`;
  }
  if (format === 'currency-decimal') {
    return `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }
  return Math.round(n).toLocaleString('he-IL');
}

export default function TestDashKpiCard({ label, value, format = 'number', icon, accent = 'gold', index = 0, switchKey = '' }) {
  const [replayKey, setReplayKey] = useState(0);
  const [tapped, setTapped] = useState(false);
  const animated = useCountUp(value, replayKey);

  // Re-run the entrance rise when the time window changes (range/year/month).
  // Skip the very first mount (the CSS `animation` already plays on load).
  const [reentered, setReentered] = useState(false);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setReentered(false);
    const raf = requestAnimationFrame(() => setReentered(true));
    return () => cancelAnimationFrame(raf);
  }, [switchKey]);

  const replay = () => {
    setReplayKey((k) => k + 1);
    // retrigger the one-shot tap pulse: clear, then re-add on next frame
    setTapped(false);
    requestAnimationFrame(() => setTapped(true));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      replay();
    }
  };

  return (
    <div
      className={`td-kpi-card td-kpi-${accent}${tapped ? ' td-kpi-tapped' : ''}${reentered ? ' td-kpi-reenter' : ''}`}
      style={{ '--td-delay': `${index * 110}ms`, '--td-reenter-delay': `${index * 70}ms` }}
      role="button"
      tabIndex={0}
      aria-label={`${label}: replay count-up animation`}
      onClick={replay}
      onKeyDown={handleKeyDown}
      onAnimationEnd={(e) => {
        if (e.animationName === 'td-tap-pulse') setTapped(false);
        if (e.animationName === 'td-reenter') setReentered(false);
      }}
    >
      <span className="td-kpi-accent-bar" aria-hidden />
      <span className="td-kpi-tap" aria-hidden />
      <span className="td-kpi-watermark" aria-hidden>{icon}</span>
      <div className="td-kpi-top">
        <span className="td-kpi-icon" aria-hidden>{icon}</span>
        <span className="td-kpi-label">{label}</span>
      </div>
      <p className="td-kpi-value">{formatValue(animated, format)}</p>
    </div>
  );
}
