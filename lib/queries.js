// lib/queries.js
// All data-fetching helpers that call the Next.js API routes

export async function getProjects() {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function getProjectById(id) {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) throw new Error('Failed to fetch project');
  return res.json();
}

export async function getMetrics() {
  const res = await fetch('/api/metrics');
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function getPayments({ limit = 50, page = 1 } = {}) {
  const res = await fetch(`/api/payments?limit=${limit}&page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch payments');
  return res.json();
}
