// lib/mockData.js
// Static project-list data — the effective source for /projects (no public.projects
// table exists in Supabase; the API/page falls back to this list).
// Rule: every insight shown must be real and defensible — no invented metrics.

export const mockProjects = [
  {
    id: 'convenience-store',
    href: '/projects/convenience-store',
    title: 'Convenience Store Analytics Platform',
    description:
      'End-to-end analytics platform on real POS data from a working convenience store: Python EL → dbt (42 models, 220+ tests) → Supabase → live 5-view Next.js executive dashboard, refreshed nightly. The client receives recurring reports built on the same pipeline.',
    tech: ['SQL', 'dbt', 'Supabase', 'Next.js', 'Python'],
    category: 'Analytics',
    status: 'live',
    dashboard_url: '/projects/convenience-store/dashboard',
    github_url: 'https://github.com/tzafHavia/local_store_pipeline',
    insights: [
      'Hourly sales-vs-wages analysis ended 24/7 operation — the owner moved to two shifts, permanent since January 2026',
      'Revenue is heavily concentrated in one category (~two-thirds of trailing-30d sales)',
      'Eliminated all recurring vendor reporting costs',
    ],
    created_at: '2026-03-23',
  },
  {
    id: 'crm-lead-capture',
    href: '/crm',
    title: 'Lead-Capture Integration: Next.js → Supabase → WhatsApp → SuiteCRM',
    description:
      'One form submission fans out across the stack: a Next.js API route persists the lead to Supabase, fires a WhatsApp template notification, and creates the lead in a self-hosted SuiteCRM over its REST API — with a live-updating results panel.',
    tech: ['Next.js', 'Supabase'],
    category: 'Integration',
    status: 'live',
    dashboard_url: '',
    github_url: '',
    insights: [
      'CRM and WhatsApp calls are fire-and-forget — lead capture never blocks on a downstream system',
      'Works even when the self-hosted CRM is offline: the lead still lands in Supabase',
    ],
    created_at: '2026-05-26',
  },
];

export const mockMetrics = [
  { date: '2024-01', revenue: 42000, transactions: 1200 },
  { date: '2024-02', revenue: 47500, transactions: 1350 },
  { date: '2024-03', revenue: 51200, transactions: 1480 },
  { date: '2024-04', revenue: 49800, transactions: 1410 },
  { date: '2024-05', revenue: 55600, transactions: 1600 },
  { date: '2024-06', revenue: 61000, transactions: 1750 },
];

export const mockKpis = {
  totalRevenue: 307100,
  totalTransactions: 8790,
  avgTransaction: 34.9,
  topProduct: 'Espresso',
};
