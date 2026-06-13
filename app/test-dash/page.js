import TestDashKpiCard from '@/components/TestDashKpiCard';
import TestDashControls from '@/components/TestDashControls';
import { fetchTestDashData } from '@/lib/dashboardData';

export const metadata = {
  title: 'Test Dashboard | DataPortfolio',
  description: 'Experimental Power BI-style dashboard layout.',
};

function formatRange(start, end) {
  if (!start || !end) return 'No data';
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(start)} — ${fmt(end)}`;
}

const VALID_RANGES = ['day', 'week', 'month'];

export default async function TestDashPage({ searchParams }) {
  const sp = await searchParams;

  const range = VALID_RANGES.includes(sp?.range) ? sp.range : 'month';

  const parsedYear = Number.parseInt(sp?.year, 10);
  const year = Number.isInteger(parsedYear) ? parsedYear : undefined;

  const parsedMonth = Number.parseInt(sp?.month, 10);
  const month = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined;

  const parsedDow = Number.parseInt(sp?.dow, 10);
  const dow = parsedDow >= 0 && parsedDow <= 6 ? parsedDow : undefined;

  const parsedWeek = Number.parseInt(sp?.week, 10);
  const week = parsedWeek >= 1 ? parsedWeek : undefined;

  const data = await fetchTestDashData({
    year,
    month,
    range,
    dayOfWeek: dow,
    weekOfMonth: week,
  });
  const { kpis } = data;

  const cards = [
    { label: 'Total Sales',   value: kpis.totalSales,   format: 'currency',         icon: '₪', accent: 'gold' },
    { label: 'Transactions',  value: kpis.totalTickets,  format: 'number',           icon: '🧾', accent: 'platinum' },
    { label: 'Avg Basket',    value: kpis.avgBasket,     format: 'currency-decimal', icon: '🛒', accent: 'emerald' },
    { label: 'Units Sold',    value: kpis.totalUnits,    format: 'number',           icon: '📦', accent: 'sapphire' },
  ];

  return (
    <div className="td-page">
      {/* Keyframes live here (not in globals.css — Turbopack drops @keyframes from it) */}
      <style>{`
        @keyframes td-rise {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes td-shimmer {
          0%        { transform: translateX(-130%); }
          55%, 100% { transform: translateX(130%); }
        }
        @keyframes td-tap-pulse {
          0%   { opacity: 0;    transform: scale(0.6); }
          35%  { opacity: 0.85; }
          100% { opacity: 0;    transform: scale(1.04); }
        }
        /* P3-4: brief re-rise + cross-fade when the time window changes. */
        @keyframes td-reenter {
          0%   { opacity: 0.35; transform: translateY(10px) scale(0.985); }
          100% { opacity: 1;    transform: none; }
        }
        /* P35-4: range-dependent sub-selector entrance (day/week mount).
           Fade + slide-in from the left with a tight width reveal so it feels
           like it springs from the segmented switch / month pair. */
        @keyframes td-subfilter-in {
          0% {
            opacity: 0;
            transform: translateX(-8px) scale(0.97);
            clip-path: inset(0 100% 0 0);
          }
          100% {
            opacity: 1;
            transform: none;
            clip-path: inset(0 0 0 0);
          }
        }
      `}</style>

      <header className="td-header">
        <p className="td-eyebrow">Experimental · Power BI style</p>
        <h1 className="td-title">Test Dashboard</h1>
        <p className="td-subtitle">{data.periodLabel || formatRange(data.periodStart, data.periodEnd)}</p>
      </header>

      <TestDashControls
        range={range}
        year={data.year}
        month={data.month}
        weekOfMonth={data.weekOfMonth}
        dayOfWeek={data.dayOfWeek}
        weeksInMonth={data.weeksInMonth}
      />

      <section className="td-kpi-grid">
        {cards.map((card, i) => (
          <TestDashKpiCard
            key={card.label}
            index={i}
            switchKey={`${range}-${data.year}-${data.month}-${data.weekOfMonth}-${data.dayOfWeek}`}
            {...card}
          />
        ))}
      </section>

      {/* Phase 2 — charts go here */}
      <section className="td-charts-placeholder">
        <p>Charts coming next — KPI strip first.</p>
      </section>
    </div>
  );
}
