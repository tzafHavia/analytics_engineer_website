export default function KpiCard({ icon, label, value, sub, color = 'blue' }) {
  return (
    <div className={`kpi-card kpi-card-${color}`}>
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-body">
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
        {sub && <p className="kpi-sub">{sub}</p>}
      </div>
      <div className="kpi-glow" />
    </div>
  );
}
