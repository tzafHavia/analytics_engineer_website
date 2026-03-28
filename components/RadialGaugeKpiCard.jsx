const COLOR_PALETTES = {
  purple: {
    solid: '#6366f1',
    soft: 'rgba(99,102,241,0.32)',
    track: 'rgba(99,102,241,0.12)',
  },
  cyan: {
    solid: '#22d3ee',
    soft: 'rgba(34,211,238,0.3)',
    track: 'rgba(34,211,238,0.12)',
  },
  green: {
    solid: '#4ade80',
    soft: 'rgba(74,222,128,0.28)',
    track: 'rgba(74,222,128,0.12)',
  },
  orange: {
    solid: '#fb923c',
    soft: 'rgba(251,146,60,0.28)',
    track: 'rgba(251,146,60,0.12)',
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pointOnArc(cx, cy, radius, angleDeg) {
  const angleRad = (Math.PI / 180) * angleDeg;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy - radius * Math.sin(angleRad),
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = pointOnArc(cx, cy, radius, startAngle);
  const end = pointOnArc(cx, cy, radius, endAngle);
  const largeArcFlag = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function RadialGaugeKpiCard({
  icon,
  label,
  timeframe,
  displayValue,
  displayPrevious,
  displayTarget,
  deltaLabel,
  deltaTone,
  color = 'purple',
  currentValue = 0,
  previousValue = 0,
  targetValue = 0,
  maxValue = 100,
  scaleMinLabel = '0',
  scaleMaxLabel,
  ariaLabel,
}) {
  const palette = COLOR_PALETTES[color] ?? COLOR_PALETTES.purple;
  const safeMax = maxValue > 0 ? maxValue : 1;
  const currentRatio = clamp(currentValue / safeMax, 0, 1);
  const previousRatio = clamp(previousValue / safeMax, 0, 1);
  const targetRatio = clamp(targetValue / safeMax, 0, 1);

  const gaugeRadius = 40;
  const chartCenterX = 60;
  const chartCenterY = 76;
  const currentEndAngle = 180 - currentRatio * 180;
  const previousEndAngle = 180 - previousRatio * 180;
  const targetAngle = 180 - targetRatio * 180;
  const markerInner = pointOnArc(chartCenterX, chartCenterY, gaugeRadius - 7, targetAngle);
  const markerOuter = pointOnArc(chartCenterX, chartCenterY, gaugeRadius + 8, targetAngle);
  const markerLabel = pointOnArc(chartCenterX, chartCenterY, gaugeRadius + 16, targetAngle);
  const markerAnchor = targetRatio > 0.72 ? 'end' : 'start';
  const markerTextX = markerLabel.x + (markerAnchor === 'start' ? 4 : -4);

  return (
    <div className={`cs-gauge-card cs-gauge-${color}`}>
      <div className="cs-gauge-header">
        <div className="cs-gauge-heading-group">
          <span className="cs-gauge-icon">{icon}</span>
          <div>
            <p className="cs-gauge-label">{label}</p>
            <p className="cs-gauge-timeframe">{timeframe}</p>
          </div>
        </div>
        <span className={`cs-gauge-delta cs-tone-${deltaTone}`}>{deltaLabel}</span>
      </div>

      <div className="cs-gauge-visual" role="img" aria-label={ariaLabel}>
        <svg viewBox="0 0 120 94" className="cs-gauge-svg" preserveAspectRatio="xMidYMid meet">
          <path
            d={describeArc(chartCenterX, chartCenterY, gaugeRadius, 180, 0)}
            fill="none"
            stroke={palette.track}
            strokeWidth="13"
            strokeLinecap="round"
          />
          {previousRatio > 0 && (
            <path
              d={describeArc(chartCenterX, chartCenterY, gaugeRadius, 180, previousEndAngle)}
              fill="none"
              stroke={palette.soft}
              strokeWidth="13"
              strokeLinecap="round"
            />
          )}
          {currentRatio > 0 && (
            <path
              d={describeArc(chartCenterX, chartCenterY, gaugeRadius, 180, currentEndAngle)}
              fill="none"
              stroke={palette.solid}
              strokeWidth="13"
              strokeLinecap="round"
            />
          )}
          <line
            x1={markerInner.x}
            y1={markerInner.y}
            x2={markerOuter.x}
            y2={markerOuter.y}
            className="cs-gauge-target-line"
          />
          <text
            x={markerTextX}
            y={markerLabel.y}
            textAnchor={markerAnchor}
            className="cs-gauge-target-text"
          >
            {`T ${displayTarget}`}
          </text>
          <text x="60" y="60" textAnchor="middle" className="cs-gauge-value-text">
            {displayValue}
          </text>
          <text x="4" y="92" className="cs-gauge-scale-text">
            {scaleMinLabel}
          </text>
          <text x="116" y="92" textAnchor="end" className="cs-gauge-scale-text">
            {scaleMaxLabel}
          </text>
        </svg>
      </div>

      <div className="cs-gauge-footer">
        <span className="cs-gauge-key">
          <span className="cs-gauge-dot cs-gauge-dot-current" style={{ backgroundColor: palette.solid }} />
          {displayValue}
        </span>
        <span className="cs-gauge-key">
          <span className="cs-gauge-dot cs-gauge-dot-previous" style={{ backgroundColor: palette.soft }} />
          {displayPrevious}
        </span>
      </div>
    </div>
  );
}