// lib/mockData.js
// Static mock data used during development before Supabase is connected

export const mockProjects = [
  {
    id: 'convenience-store',
    href: '/projects/convenience-store',
    title: 'Convenience Store Analytics Platform',
    description:
      'End-to-end data pipeline that transforms raw POS transactions into dashboards, automated reports, and financial insights — replacing expensive vendor tools at zero recurring cost.',
    tech: ['SQL', 'dbt', 'Supabase', 'Next.js', 'Python'],
    category: 'Analytics',
    status: 'live',
    dashboard_url: '',
    github_url: 'https://github.com',
    insights: [
      'A small number of products generated the majority of total revenue',
      'Peak sales hours consistently occurred in the evening',
      'Eliminated all recurring vendor reporting costs',
    ],
    created_at: '2024-03-23',
  },
  {
    id: 1,
    title: 'POS Sales Analytics',
    description:
      'End-to-end analysis of point-of-sale transactions. Identifies peak hours, top products, and revenue trends across store locations.',
    tech: ['SQL', 'dbt', 'Supabase', 'Python'],
    category: 'Sales',
    status: 'live',
    dashboard_url: '',
    github_url: 'https://github.com',
    insights: [
      'Revenue peaks on Friday evenings',
      'Top product: Espresso (22% of sales)',
      'Average transaction value grew 15% MoM',
    ],
    created_at: '2024-01-15',
  },
  {
    id: 2,
    title: 'Customer Segmentation',
    description:
      'RFM (Recency, Frequency, Monetary) model built with dbt to segment customers and drive targeted marketing campaigns.',
    tech: ['dbt', 'SQL', 'Python'],
    category: 'Marketing',
    status: 'live',
    dashboard_url: '',
    github_url: 'https://github.com',
    insights: [
      '4 distinct customer segments identified',
      'VIP customers generate 60% of revenue',
      'Churned segment decreased 8% after campaign',
    ],
    created_at: '2024-02-20',
  },
  {
    id: 3,
    title: 'Payments Dashboard',
    description:
      'Full payment flow tracking from the shlomy_store schema. Monitors payment methods, success rates, and daily totals.',
    tech: ['Next.js', 'Supabase', 'Recharts'],
    category: 'Finance',
    status: 'live',
    dashboard_url: '',
    github_url: 'https://github.com',
    insights: [
      'Credit card is the dominant payment method',
      'Average daily revenue: ₪12,400',
      '99.2% payment success rate',
    ],
    created_at: '2024-03-10',
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
