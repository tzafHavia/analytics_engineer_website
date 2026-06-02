/**
 * lib/dashboardData.js
 *
 * Dashboard data-fetching layer for the Convenience Store Analytics Platform.
 * Queries the `raw` schema in Supabase via direct pg Pool (NEXT_DATABASE_URL).
 *
 * Note: tables are in `raw` schema, not `public`. PostgREST only exposes `public`
 * so the Supabase JS client cannot reach them — pg Pool is required.
 *
 * Tables (all in `raw` schema):
 *   rpt_daily_sales            — daily sales aggregates
 *   rpt_sales_trend_daily      — daily sales with period-over-period + 7d avg columns
 *   rpt_executive_summary_daily — combined sales + inventory snapshot per day
 *   rpt_product_performance_30d — 30-day product-level performance
 *   rpt_inventory_risk          — current inventory risk per product per snapshot
 *   dim_product                 — product dimension
 */

import { Pool } from 'pg';

// ─── pg Pool (server-only) ────────────────────────────────────────────────────
let _pool;
function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.NEXT_DATABASE_URL });
  }
  return _pool;
}

async function query(sql, params = []) {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toNumber(v, fallback = 0) {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toIsoDate(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
}

const STATUS_LABEL_MAP = {
  out_of_stock: 'Out of stock',
  low_stock: 'Low stock',
  overstock: 'Overstock',
  healthy: 'Healthy',
  fast: 'Fast mover',
  medium: 'Medium mover',
  slow: 'Slow mover',
  dead: 'Dead stock',
};

function normalizeStatusLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return STATUS_LABEL_MAP[key] ?? (key.length ? key[0].toUpperCase() + key.slice(1) : '—');
}

function isValidDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function shiftIsoDate(isoDate, days) {
  // Normalize first — handles timestamps like "2026-03-20 00:00:00"
  const cleanDate = String(isoDate || '').slice(0, 10);
  const d = new Date(`${cleanDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDaySpan(start, end) {
  return Math.max(
    1,
    Math.round(
      (new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000
    ) + 1
  );
}

function buildEmptyState(filters = {}) {
  return {
    freshness: null,
    latestSaleDate: null,
    currentPeriod: { start: null, end: null, days: 30 },
    previousPeriod: { start: null, end: null, days: 30 },
    activeFilters: filters,
    kpis: {
      totalSales: 0,
      salesDeltaPct: null,
      totalTickets: 0,
      avgTicketAmount: 0,
      totalUnitsSold: 0,
      outOfStockCount: 0,
      stockoutRiskCount: 0,
      avgDaysOfCover: null,
    },
    dailySalesTrend: [],
    ticketTrend: [],
    topProducts: [],
    topProductsMetric: {
      key: 'salesAmount30d',
      label: 'Revenue',
      heading: 'Top 10 products by revenue',
      description: 'Products ranked by rolling 30-day sales amount.',
      valueFormat: 'currency-compact',
    },
    inventoryDistribution: [],
    recentDailyPerformance: [],
  };
}

// ─── Main dashboard fetch ─────────────────────────────────────────────────────
export async function fetchOverviewDashboardData(rawFilters = {}) {
  // Step 1 — Anchor date from latest row
  let latestRows;
  try {
    latestRows = await query('SELECT MAX(sale_date)::text AS latest FROM raw.rpt_daily_sales');
  } catch (e) {
    console.error('[dashboardData] failed to connect:', e.message);
    return buildEmptyState(rawFilters);
  }

  // Apply toIsoDate to normalize timestamp strings (e.g. "2026-03-20 00:00:00" → "2026-03-20")
  const latestSaleDate = latestRows[0]?.latest ? toIsoDate(latestRows[0].latest) : null;
  if (!latestSaleDate) return buildEmptyState(rawFilters);

  // Step 2 — Resolve date range
  const defaultEnd = latestSaleDate;
  const defaultStart = shiftIsoDate(latestSaleDate, -29);

  const dateFrom = isValidDate(rawFilters.dateFrom) ? rawFilters.dateFrom : defaultStart;
  const dateTo = isValidDate(rawFilters.dateTo) ? rawFilters.dateTo : defaultEnd;
  const safeFrom = dateFrom <= dateTo ? dateFrom : defaultStart;
  const safeTo = dateFrom <= dateTo ? dateTo : defaultEnd;

  const spanDays = getDaySpan(safeFrom, safeTo);
  const prevEnd = shiftIsoDate(safeFrom, -1);
  const prevStart = shiftIsoDate(prevEnd, -(spanDays - 1));

  // Step 3 — Fire all queries in parallel
  const [
    currentRows,
    prevRows,
    execRows,
    trendRows,
    recentRows,
    invRiskRows,
    topProductRows,
  ] = await Promise.all([
    // Current period KPI aggregation
    query(
      `SELECT sale_date::text, total_sales_amount, total_units_sold, ticket_count, avg_ticket_amount
       FROM raw.rpt_daily_sales
       WHERE sale_date BETWEEN $1 AND $2
       ORDER BY sale_date`,
      [safeFrom, safeTo]
    ),

    // Previous period totals for delta
    query(
      `SELECT COALESCE(SUM(total_sales_amount), 0) AS prev_sales
       FROM raw.rpt_daily_sales
       WHERE sale_date BETWEEN $1 AND $2`,
      [prevStart, prevEnd]
    ),

    // Latest executive summary row (avg_days_of_cover only — OOS counts from rpt_inventory_risk)
    query(
      `SELECT sale_date::text, avg_days_of_cover_30d
       FROM raw.rpt_executive_summary_daily
       ORDER BY sale_date DESC
       LIMIT 1`
    ),

    // Sales trend with 7d avg and WoW comparison (includes ticket_count)
    query(
      `SELECT sale_date::text, total_sales_amount, ticket_count,
              sales_7d_avg, sales_prev_week_same_day
       FROM raw.rpt_sales_trend_daily
       WHERE sale_date BETWEEN $1 AND $2
       ORDER BY sale_date`,
      [safeFrom, safeTo]
    ),

    // Last 14 days for performance table
    query(
      `SELECT sale_date::text, total_sales_amount, total_units_sold, ticket_count, avg_ticket_amount
       FROM raw.rpt_daily_sales
       ORDER BY sale_date DESC
       LIMIT 14`
    ),

    // Latest inventory snapshot with per-status counts
    query(
      `SELECT snapshot_date::text, stock_status, COUNT(*) AS cnt
       FROM raw.rpt_inventory_risk
       WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM raw.rpt_inventory_risk)
       GROUP BY snapshot_date, stock_status`
    ),

    // Top 10 products by 30d revenue (has item_name/category directly — no join needed)
    query(
      `SELECT item_id, item_name, product_category_name,
              sales_amount_30d, units_sold_30d, sold_qty_30d,
              estimated_gross_profit_30d, current_inventory_qty,
              velocity_band, stock_status
       FROM raw.rpt_product_performance_30d
       ORDER BY sales_amount_30d DESC NULLS LAST
       LIMIT 10`
    ),
  ]);

  // Step 4 — Compute KPIs from current period rows
  const totalSales = currentRows.reduce((s, r) => s + toNumber(r.total_sales_amount), 0);
  const totalUnitsSold = currentRows.reduce((s, r) => s + toNumber(r.total_units_sold), 0);
  const totalTickets = currentRows.reduce((s, r) => s + toNumber(r.ticket_count), 0);
  const avgTicketAmount = totalTickets > 0 ? totalSales / totalTickets : 0;

  const prevTotalSales = toNumber(prevRows[0]?.prev_sales);
  const salesDeltaPct =
    prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : null;

  const execRow = execRows[0] ?? null;
  const avgDaysOfCover = execRow?.avg_days_of_cover_30d != null
    ? toNumber(execRow.avg_days_of_cover_30d)
    : null;
  const freshness = execRow ? toIsoDate(execRow.sale_date) : latestSaleDate;

  // Count OOS and stockout risk from the inventory snapshot (exec summary has nulls)
  const invCountMap = {};
  for (const row of invRiskRows) {
    invCountMap[String(row.stock_status || '').toUpperCase()] = toNumber(row.cnt);
  }
  const outOfStockCount = invCountMap['OUT_OF_STOCK'] ?? 0;
  const stockoutRiskCount = invCountMap['STOCKOUT_RISK'] ?? 0;

  // Step 5 — Inventory distribution from pre-aggregated snapshot rows
  // Canonical display order
  const STATUS_ORDER = ['OUT_OF_STOCK', 'STOCKOUT_RISK', 'OVERSTOCK', 'DEAD_STOCK'];
  const snapshotDate = invRiskRows[0]?.snapshot_date ?? null;

  const seenKeys = new Set();
  const inventoryDistribution = STATUS_ORDER
    .filter((k) => invCountMap[k] > 0)
    .map((k) => {
      seenKeys.add(k);
      return {
        key: k,
        label: normalizeStatusLabel(k.toLowerCase()),
        value: invCountMap[k],
        snapshotDate,
      };
    });

  // Append any unexpected status values
  for (const [k, count] of Object.entries(invCountMap)) {
    if (!seenKeys.has(k) && count > 0) {
      inventoryDistribution.push({
        key: k,
        label: normalizeStatusLabel(k.toLowerCase()),
        value: count,
        snapshotDate,
      });
    }
  }

  // Step 6 — Top products
  const topProducts = topProductRows.map((row) => ({
    itemId: row.item_id,
    itemName: row.item_name || `Product #${row.item_id}`,
    categoryName: row.product_category_name || '—',
    salesAmount30d: toNumber(row.sales_amount_30d),
    unitsSold30d: toNumber(row.units_sold_30d),
    soldQty30d: toNumber(row.sold_qty_30d ?? row.units_sold_30d),
    estimatedGrossProfit30d: toNumber(row.estimated_gross_profit_30d),
    currentInventoryQty: toNumber(row.current_inventory_qty),
    velocityBand: row.velocity_band || '—',
    stockStatus: normalizeStatusLabel(row.stock_status),
  }));

  const topProductsMetric = {
    key: 'salesAmount30d',
    label: 'Revenue (30d)',
    heading: 'Top 10 products by revenue',
    description: 'Products ranked by rolling 30-day net sales amount.',
    valueFormat: 'currency-compact',
  };

  // Step 7 — Trend series from rpt_sales_trend_daily
  const dailySalesTrend = trendRows.map((row) => ({
    date: toIsoDate(row.sale_date),
    sales: toNumber(row.total_sales_amount),
    avg7d: row.sales_7d_avg != null ? toNumber(row.sales_7d_avg) : undefined,
    prevWeek: row.sales_prev_week_same_day != null
      ? toNumber(row.sales_prev_week_same_day)
      : undefined,
  }));

  const ticketTrend = trendRows.map((row) => ({
    date: toIsoDate(row.sale_date),
    tickets: toNumber(row.ticket_count),
  }));

  return {
    freshness,
    latestSaleDate,
    currentPeriod: { start: safeFrom, end: safeTo, days: spanDays },
    previousPeriod: { start: prevStart, end: prevEnd, days: spanDays },
    activeFilters: {
      dateFrom: rawFilters.dateFrom || null,
      dateTo: rawFilters.dateTo || null,
      productCategory: rawFilters.productCategory || null,
      itemName: rawFilters.itemName || null,
      stockStatus: rawFilters.stockStatus || null,
      velocityBand: rawFilters.velocityBand || null,
    },
    kpis: {
      totalSales,
      salesDeltaPct,
      totalTickets,
      avgTicketAmount,
      totalUnitsSold,
      outOfStockCount,
      stockoutRiskCount,
      avgDaysOfCover,
    },
    dailySalesTrend,
    ticketTrend,
    topProducts,
    topProductsMetric,
    inventoryDistribution,
    recentDailyPerformance: recentRows.map((row) => ({
      saleDate: toIsoDate(row.sale_date),
      totalSalesAmount: toNumber(row.total_sales_amount),
      totalUnitsSold: toNumber(row.total_units_sold),
      ticketCount: toNumber(row.ticket_count),
      avgTicketAmount: toNumber(row.avg_ticket_amount),
    })),
  };
}

// ─── Filter options ───────────────────────────────────────────────────────────
export async function fetchOverviewFilterOptions() {
  try {
    const [productRows, invRows] = await Promise.all([
      query(
        `SELECT DISTINCT product_category_name, item_name
         FROM raw.rpt_product_performance_30d
         ORDER BY product_category_name, item_name`
      ),
      query(
        `SELECT DISTINCT stock_status, velocity_band
         FROM raw.rpt_inventory_risk
         WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM raw.rpt_inventory_risk)`
      ),
    ]);

    const categories = [...new Set(productRows.map((r) => r.product_category_name).filter(Boolean))].sort();
    const itemNames = [...new Set(productRows.map((r) => r.item_name).filter(Boolean))].sort();
    const stockStatuses = [...new Set(invRows.map((r) => r.stock_status).filter(Boolean))];
    const velocityBands = [...new Set(invRows.map((r) => r.velocity_band).filter(Boolean))];

    return {
      productCategories: categories,
      itemNames,
      stockStatuses: stockStatuses.map((v) => ({ value: v, label: normalizeStatusLabel(v) })),
      velocityBands: velocityBands.map((v) => ({ value: v, label: normalizeStatusLabel(v) })),
    };
  } catch (e) {
    console.error('[dashboardData] fetchOverviewFilterOptions error:', e.message);
    return { productCategories: [], itemNames: [], stockStatuses: [], velocityBands: [] };
  }
}

