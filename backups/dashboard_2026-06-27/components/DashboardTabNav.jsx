'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'sales',      label: 'Sales' },
  { key: 'inventory',  label: 'Inventory' },
  { key: 'products',   label: 'Products & Categories' },
  { key: 'workforce',  label: 'Workforce' },
];

const BASE_PATH = '/projects/convenience-store/dashboard';

export default function DashboardTabNav() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  function buildHref(tabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabKey === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tabKey);
    }
    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  return (
    <nav className="dash-tab-nav" aria-label="Dashboard sections">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={buildHref(tab.key)}
          className="dash-tab-link"
          aria-current={activeTab === tab.key ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
