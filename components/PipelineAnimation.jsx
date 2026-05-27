'use client';

const NODES = [
  {
    id: 'db',
    label: 'Database',
    sub: 'PostgreSQL',
    color: 'cyan',
    icon: '🗄️',
    enterDelay: '0s',
    swayDelay: '0.85s',
  },
  {
    id: 'dbt',
    label: 'dbt',
    sub: 'Transform',
    color: 'orange',
    icon: '⚙️',
    enterDelay: '0.4s',
    swayDelay: '1.25s',
  },
  {
    id: 'dash',
    label: 'Dashboard',
    sub: 'Insights',
    color: 'purple',
    icon: '📊',
    enterDelay: '0.8s',
    swayDelay: '1.65s',
  },
];

const CONNECTORS = [
  { id: 'c1', lineDelay: '1.4s', headDelay: '1.9s', dotDelays: [2.1, 2.65, 3.2] },
  { id: 'c2', lineDelay: '1.7s', headDelay: '2.2s', dotDelays: [2.5, 3.05, 3.6] },
];

function CubeNode({ node }) {
  return (
    <div className="pa-node">
      <div
        className={`pa-cube-outer pa-cube--${node.color}`}
        style={{ '--enter-delay': node.enterDelay }}
      >
        <div className="pa-cube" style={{ '--sway-delay': node.swayDelay }}>
          <div className="pa-face pa-face-front">
            <span className="pa-face-icon">{node.icon}</span>
            <span className="pa-face-text">{node.label}</span>
          </div>
          <div className="pa-face pa-face-back" />
          <div className="pa-face pa-face-right" />
          <div className="pa-face pa-face-left" />
          <div className="pa-face pa-face-top" />
          <div className="pa-face pa-face-bottom" />
        </div>
      </div>
      <span className="pa-node-name">{node.label}</span>
      <span className="pa-node-sub">{node.sub}</span>
    </div>
  );
}

function Connector({ conn }) {
  return (
    <div className="pa-connector" aria-hidden="true">
      <svg className="pa-conn-svg" viewBox="0 0 88 24" fill="none">
        {/* Animated line */}
        <line
          x1="2"
          y1="12"
          x2="72"
          y2="12"
          className="pa-conn-line"
          style={{ '--line-delay': conn.lineDelay }}
        />
        {/* Arrowhead */}
        <polygon
          points="70,7 83,12 70,17"
          className="pa-conn-head"
          style={{ '--head-delay': conn.headDelay }}
        />
        {/* Flowing data dots */}
        {conn.dotDelays.map((delay, i) => (
          <circle
            key={i}
            cy="12"
            r="2.5"
            className="pa-conn-dot"
            style={{ '--pd': `${delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

export default function PipelineAnimation() {
  return (
    <div className="pa-wrap" role="img" aria-label="Data pipeline: Database → dbt → Dashboard">
      <p className="pa-eyebrow">Data Pipeline Flow</p>
      <div className="pa-scene">
        <CubeNode node={NODES[0]} />
        <Connector conn={CONNECTORS[0]} />
        <CubeNode node={NODES[1]} />
        <Connector conn={CONNECTORS[1]} />
        <CubeNode node={NODES[2]} />
      </div>
    </div>
  );
}
