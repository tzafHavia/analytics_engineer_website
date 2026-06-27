'use client';

/**
 * Tiny inline sparkline for KPI cards. Lightweight SVG polyline — no axes,
 * grid, tooltip or Recharts overhead. Renders a single muted-accent line.
 *
 * Props:
 *   data    — array of points
 *   dataKey — key to read the numeric value from each point (default 'value')
 *   color   — stroke color (default muted teal accent)
 *   height  — px height (default 40)
 */
export default function KpiSparkline({ data, dataKey = 'value', color = '#00D4AA', height = 40 }) {
  const series = Array.isArray(data)
    ? data.map((d) => Number(d?.[dataKey])).filter((n) => Number.isFinite(n))
    : [];

  if (series.length < 2) return null;

  const width = 100; // viewBox units; stretched via preserveAspectRatio
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);
  const pad = 3; // vertical padding inside viewBox

  const points = series
    .map((v, i) => {
      const x = i * stepX;
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const lastV = series[series.length - 1];
  const lastX = (series.length - 1) * stepX;
  const lastY = pad + (1 - (lastV - min) / range) * (height - pad * 2);

  return (
    <svg
      className="dash-kpi-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.85"
      />
      <circle cx={lastX} cy={lastY} r="1.8" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
