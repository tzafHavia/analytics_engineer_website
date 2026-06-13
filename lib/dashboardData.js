/**
 * lib/dashboardData.js
 *
 * Dashboard data-fetching layer for the Convenience Store Analytics Platform.
 * Queries the `raw` schema in Supabase via direct pg Pool (NEXT_DATABASE_URL).
 *
 * Note: tables are in `store_pipeline` schema, not `public`. PostgREST only exposes `public`
 * so the Supabase JS client cannot reach them — pg Pool is required.
 *
 * Tables (all in `store_pipeline` schema):
 *   rpt_daily_sales            — daily sales aggregates
 *   rpt_sales_trend_daily      — daily sales with period-over-period + 7d avg columns
 *   rpt_executive_summary_daily — combined sales + inventory snapshot per day
 *   rpt_product_performance_30d — 30-day product-level performance
 *   rpt_inventory_risk          — current inventory risk per product per snapshot
 *   dim_product                 — product dimension
 */

import { Pool } from 'pg';
import { unstable_cache } from 'next/cache';

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

function trimOrNull(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
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
async function fetchOverviewDashboardData_core(rawFilters = {}) {
  // Step 1 — Anchor date from latest row
  let latestRows;
  try {
    latestRows = await query('SELECT MAX(sale_date)::text AS latest FROM store_pipeline.rpt_daily_sales');
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

  // Step 2b — Category / item scope.
  // rpt_daily_sales has no category dimension, so when a category or item filter
  // is active we recompute the daily series from int_sales__daily_product joined
  // to dim_product (item_id → category_name). When unfiltered we keep the faster
  // pre-aggregated reporting tables.
  const categoryFilter = trimOrNull(rawFilters.productCategory);
  const itemFilter = trimOrNull(rawFilters.itemName);
  const isScoped = Boolean(categoryFilter || itemFilter);

  // Builds the trailing scope predicate + params starting at a given placeholder index.
  function scopePredicate(startIdx) {
    const parts = [];
    const params = [];
    let i = startIdx;
    if (categoryFilter) { parts.push(`AND p.category_name = $${i++}`); params.push(categoryFilter); }
    if (itemFilter)     { parts.push(`AND p.item_name = $${i++}`); params.push(itemFilter); }
    return { sql: parts.join(' '), params };
  }

  // Daily KPI rows (current period) — scoped vs. store-wide
  const currentScope = scopePredicate(3);
  const currentQuery = isScoped
    ? {
        sql: `SELECT d.sale_date::text,
                     SUM(d.net_sales_amount)                                 AS total_sales_amount,
                     SUM(d.sold_qty)                                         AS total_units_sold,
                     SUM(d.tickets_count)                                    AS ticket_count,
                     SUM(d.net_sales_amount) / NULLIF(SUM(d.tickets_count),0) AS avg_ticket_amount
              FROM store_pipeline.int_sales__daily_product d
              JOIN store_pipeline.dim_product p ON p.item_id = d.item_id
              WHERE d.sale_date BETWEEN $1 AND $2 ${currentScope.sql}
              GROUP BY d.sale_date
              ORDER BY d.sale_date`,
        params: [safeFrom, safeTo, ...currentScope.params],
      }
    : {
        sql: `SELECT sale_date::text, total_sales_amount, total_units_sold, ticket_count, avg_ticket_amount
              FROM store_pipeline.rpt_daily_sales
              WHERE sale_date BETWEEN $1 AND $2
              ORDER BY sale_date`,
        params: [safeFrom, safeTo],
      };

  // Previous period total for delta — scoped vs. store-wide
  const prevScope = scopePredicate(3);
  const prevQuery = isScoped
    ? {
        sql: `SELECT COALESCE(SUM(d.net_sales_amount), 0) AS prev_sales
              FROM store_pipeline.int_sales__daily_product d
              JOIN store_pipeline.dim_product p ON p.item_id = d.item_id
              WHERE d.sale_date BETWEEN $1 AND $2 ${prevScope.sql}`,
        params: [prevStart, prevEnd, ...prevScope.params],
      }
    : {
        sql: `SELECT COALESCE(SUM(total_sales_amount), 0) AS prev_sales
              FROM store_pipeline.rpt_daily_sales
              WHERE sale_date BETWEEN $1 AND $2`,
        params: [prevStart, prevEnd],
      };

  // Sales trend with 7d avg — scoped recomputes the rolling avg from the join,
  // widening the lower bound by 6 days so the left edge of the window is correct.
  const trendScope = scopePredicate(3);
  const trendQuery = isScoped
    ? {
        sql: `WITH daily AS (
                SELECT d.sale_date,
                       SUM(d.net_sales_amount) AS total_sales_amount,
                       SUM(d.tickets_count)    AS ticket_count
                FROM store_pipeline.int_sales__daily_product d
                JOIN store_pipeline.dim_product p ON p.item_id = d.item_id
                WHERE d.sale_date BETWEEN ($1::date - INTERVAL '6 day') AND $2::date ${trendScope.sql}
                GROUP BY d.sale_date
              )
              SELECT sale_date::text, total_sales_amount, ticket_count,
                     AVG(total_sales_amount) OVER (
                       ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                     ) AS sales_7d_avg,
                     NULL::numeric AS sales_prev_week_same_day
              FROM daily
              WHERE sale_date BETWEEN $1::date AND $2::date
              ORDER BY sale_date`,
        params: [safeFrom, safeTo, ...trendScope.params],
      }
    : {
        sql: `SELECT sale_date::text, total_sales_amount, ticket_count,
                     sales_7d_avg, sales_prev_week_same_day
              FROM store_pipeline.rpt_sales_trend_daily
              WHERE sale_date BETWEEN $1 AND $2
              ORDER BY sale_date`,
        params: [safeFrom, safeTo],
      };

  // Daily performance table (newest first) — scoped vs. store-wide
  const recentScope = scopePredicate(3);
  const recentQuery = isScoped
    ? {
        sql: `SELECT d.sale_date::text,
                     SUM(d.net_sales_amount)                                 AS total_sales_amount,
                     SUM(d.sold_qty)                                         AS total_units_sold,
                     SUM(d.tickets_count)                                    AS ticket_count,
                     SUM(d.net_sales_amount) / NULLIF(SUM(d.tickets_count),0) AS avg_ticket_amount
              FROM store_pipeline.int_sales__daily_product d
              JOIN store_pipeline.dim_product p ON p.item_id = d.item_id
              WHERE d.sale_date BETWEEN $1 AND $2 ${recentScope.sql}
              GROUP BY d.sale_date
              ORDER BY d.sale_date DESC`,
        params: [safeFrom, safeTo, ...recentScope.params],
      }
    : {
        sql: `SELECT sale_date::text, total_sales_amount, total_units_sold, ticket_count, avg_ticket_amount
              FROM store_pipeline.rpt_daily_sales
              WHERE sale_date BETWEEN $1 AND $2
              ORDER BY sale_date DESC`,
        params: [safeFrom, safeTo],
      };

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
    // Current period KPI aggregation (scoped by category/item when filtered)
    query(currentQuery.sql, currentQuery.params),

    // Previous period totals for delta (scoped by category/item when filtered)
    query(prevQuery.sql, prevQuery.params),

    // Latest executive summary row (avg_days_of_cover only — OOS counts from rpt_inventory_risk)
    query(
      `SELECT sale_date::text, avg_days_of_cover_30d
       FROM store_pipeline.rpt_executive_summary_daily
       ORDER BY sale_date DESC
       LIMIT 1`
    ),

    // Sales trend with 7d avg and WoW comparison (scoped by category/item when filtered)
    query(trendQuery.sql, trendQuery.params),

    // Daily performance for selected period (scoped by category/item when filtered)
    query(recentQuery.sql, recentQuery.params),

    // Latest inventory snapshot with per-status counts
    query(
      `SELECT snapshot_date::text, stock_status, COUNT(*) AS cnt
       FROM store_pipeline.rpt_inventory_risk
       WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_risk)
       GROUP BY snapshot_date, stock_status`
    ),

    // Top 10 products by 30d revenue (has item_name/category directly — no join needed)
    query(
      `SELECT item_id, item_name, product_category_name,
              sales_amount_30d, units_sold_30d, sold_qty_30d,
              estimated_gross_profit_30d, current_inventory_qty,
              velocity_band, stock_status
       FROM store_pipeline.rpt_product_performance_30d
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
    description: 'Rolling 30-day window — this ranking is independent of the date filter above.',
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
async function fetchOverviewFilterOptions_core() {
  try {
    const [productRows, invRows] = await Promise.all([
      query(
        `SELECT DISTINCT product_category_name, item_name
         FROM store_pipeline.rpt_product_performance_30d
         ORDER BY product_category_name, item_name`
      ),
      query(
        `SELECT DISTINCT stock_status, velocity_band
         FROM store_pipeline.rpt_inventory_risk
         WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_risk)`
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

// ─── Inventory tab fetch ──────────────────────────────────────────────────────
async function fetchInventoryDashboardData_core() {
  const EMPTY = {
    snapshotDate: null,
    kpis: { totalItems: 0, outOfStockCount: 0, stockoutRiskCount: 0, overstockCount: 0, deadStockCount: 0, avgDaysOfCover: null },
    inventoryDistribution: [],
    coverHistogram: [],
    scatterData: [],
    reorderItems: [],
    overstockItems: [],
    deadStockItems: [],
  };

  try {
    const [riskRows, histRows, scatterRows, actionRows, deadRows] = await Promise.all([
      // KPI aggregation: count by status × velocity + weighted avg doc
      query(
        `SELECT snapshot_date::text, stock_status, velocity_band,
                COUNT(*) AS cnt, AVG(days_of_cover_30d) AS avg_doc
         FROM store_pipeline.rpt_inventory_risk
         WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_risk)
         GROUP BY snapshot_date, stock_status, velocity_band`
      ),

      // Days-of-cover histogram (bucketed)
      query(
        `SELECT
           CASE
             WHEN days_of_cover_30d IS NULL THEN 'No data'
             WHEN days_of_cover_30d < 7     THEN '0–7d'
             WHEN days_of_cover_30d < 14    THEN '7–14d'
             WHEN days_of_cover_30d < 30    THEN '14–30d'
             ELSE '30d+'
           END AS bucket,
           CASE
             WHEN days_of_cover_30d IS NULL THEN 4
             WHEN days_of_cover_30d < 7     THEN 0
             WHEN days_of_cover_30d < 14    THEN 1
             WHEN days_of_cover_30d < 30    THEN 2
             ELSE 3
           END AS sort_order,
           COUNT(*) AS cnt
         FROM store_pipeline.rpt_inventory_risk
         WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_risk)
         GROUP BY 1, 2
         ORDER BY 2`
      ),

      // Scatter: current inventory qty vs 30d sold qty per product
      query(
        `SELECT pv.item_id, dp.item_name, dp.category_name AS product_category_name,
                pv.current_inventory_qty, pv.sold_qty_30d,
                pv.velocity_band, pv.days_of_cover_30d
         FROM store_pipeline.rpt_product_velocity pv
         JOIN store_pipeline.dim_product dp USING (item_id)
         WHERE pv.snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_product_velocity)
           AND pv.current_inventory_qty IS NOT NULL
         ORDER BY pv.sold_qty_30d DESC NULLS LAST
         LIMIT 200`
      ),

      // Action items (reorder + overstock) from dedicated table
      query(
        `SELECT ia.item_id, dp.item_name, dp.category_name AS product_category_name,
                ia.stock_status, ia.reorder_flag, ia.action_priority, ia.recommended_action,
                r.current_inventory_qty, r.days_of_cover_30d, r.velocity_band
         FROM store_pipeline.rpt_inventory_actions ia
         JOIN store_pipeline.dim_product dp USING (item_id)
         LEFT JOIN store_pipeline.rpt_inventory_risk r
           ON r.item_id = ia.item_id
           AND r.snapshot_date = ia.snapshot_date
         WHERE ia.snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_actions)
         ORDER BY ia.action_priority ASC NULLS LAST, ia.item_id`
      ),

      // Dead stock: items with near-zero movement from inventory risk
      query(
        `SELECT r.item_id, dp.item_name, dp.category_name AS product_category_name,
                r.stock_status, r.current_inventory_qty, r.days_of_cover_30d, r.velocity_band
         FROM store_pipeline.rpt_inventory_risk r
         JOIN store_pipeline.dim_product dp USING (item_id)
         WHERE r.snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_risk)
           AND r.velocity_band = 'NO_RECENT_SALES'
         ORDER BY r.current_inventory_qty DESC NULLS LAST
         LIMIT 50`
      ),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    let totalItems = 0, outOfStockCount = 0, stockoutRiskCount = 0, overstockCount = 0, deadStockCount = 0;
    let totalWeightedDoc = 0, totalDocCount = 0;
    const statusMap = {};

    for (const row of riskRows) {
      const cnt = toNumber(row.cnt);
      const avgDoc = row.avg_doc != null ? toNumber(row.avg_doc) : null;
      const status = String(row.stock_status || '').toLowerCase();
      const velocity = String(row.velocity_band || '').toLowerCase();

      totalItems += cnt;
      statusMap[status] = (statusMap[status] || 0) + cnt;

      if (status === 'out_of_stock') outOfStockCount += cnt;
      if (status === 'stockout_risk') stockoutRiskCount += cnt;
      if (status === 'overstock') overstockCount += cnt;
      if (velocity === 'no_recent_sales') deadStockCount += cnt;
      if (avgDoc != null) { totalWeightedDoc += avgDoc * cnt; totalDocCount += cnt; }
    }

    const avgDaysOfCover = totalDocCount > 0 ? totalWeightedDoc / totalDocCount : null;
    const snapshotDate = riskRows[0]?.snapshot_date ? toIsoDate(riskRows[0].snapshot_date) : null;

    // ── Inventory distribution for donut chart ────────────────────────────────
    const STATUS_ORDER = ['out_of_stock', 'stockout_risk', 'overstock', 'dead_stock'];
    const STATUS_COLORS = { out_of_stock: '#ef4444', stockout_risk: '#f59e0b', overstock: '#22c55e', dead_stock: '#94a3b8' };
    const inventoryDistribution = STATUS_ORDER
      .filter(k => (statusMap[k] || 0) > 0)
      .map(k => ({ key: k.toUpperCase(), label: normalizeStatusLabel(k), value: statusMap[k], color: STATUS_COLORS[k], snapshotDate }));

    // ── Histogram ─────────────────────────────────────────────────────────────
    const coverHistogram = histRows.map(row => ({
      bucket: row.bucket,
      count: toNumber(row.cnt),
    }));

    // ── Scatter ───────────────────────────────────────────────────────────────
    const scatterData = scatterRows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      inventoryQty: toNumber(row.current_inventory_qty),
      soldQty30d: toNumber(row.sold_qty_30d),
      velocityBand: row.velocity_band || 'unknown',
      daysOfCover30d: row.days_of_cover_30d != null ? toNumber(row.days_of_cover_30d) : null,
    }));

    // ── Action items ──────────────────────────────────────────────────────────
    const mapAction = row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      stockStatus: row.stock_status,
      reorderFlag: row.reorder_flag,
      actionPriority: toNumber(row.action_priority),
      recommendedAction: row.recommended_action || '',
      inventoryQty: toNumber(row.current_inventory_qty),
      daysOfCover30d: row.days_of_cover_30d != null ? toNumber(row.days_of_cover_30d) : null,
      velocityBand: row.velocity_band || '—',
    });

    const reorderItems = actionRows.filter(r => r.reorder_flag === true).map(mapAction);
    const overstockItems = actionRows.filter(r => String(r.stock_status || '').toLowerCase() === 'overstock').map(mapAction);
    const deadStockItems = deadRows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      stockStatus: row.stock_status,
      inventoryQty: toNumber(row.current_inventory_qty),
      daysOfCover30d: row.days_of_cover_30d != null ? toNumber(row.days_of_cover_30d) : null,
      velocityBand: row.velocity_band || 'NO_RECENT_SALES',
      recommendedAction: 'Consider markdown or removal',
    }));

    return { snapshotDate, kpis: { totalItems, outOfStockCount, stockoutRiskCount, overstockCount, deadStockCount, avgDaysOfCover }, inventoryDistribution, coverHistogram, scatterData, reorderItems, overstockItems, deadStockItems };
  } catch (e) {
    console.error('[dashboardData] fetchInventoryDashboardData error:', e.message);
    return EMPTY;
  }
}

// ─── Sales tab fetch ──────────────────────────────────────────────────────────
async function fetchSalesDashboardData_core(rawFilters = {}) {
  const EMPTY = {
    currentPeriod: { start: null, end: null, days: 30 },
    previousPeriod: { start: null, end: null, days: 30 },
    kpis: { totalSales: 0, salesDeltaPct: null, totalUnitsSold: 0, totalTickets: 0, avgTicketAmount: 0, returnRate: null, creditShare: null },
    salesTrend: [],
    avgTicketTrend: [],
    paymentMix: [],
    hourlyBreakdown: [],
    returnsByProduct: [],
  };

  try {
    const latestRows = await query('SELECT MAX(sale_date)::text AS latest FROM store_pipeline.rpt_daily_sales');
    const latestSaleDate = latestRows[0]?.latest ? toIsoDate(latestRows[0].latest) : null;
    if (!latestSaleDate) return EMPTY;

    const defaultEnd = latestSaleDate;
    const defaultStart = shiftIsoDate(latestSaleDate, -29);
    const dateFrom = isValidDate(rawFilters.dateFrom) ? rawFilters.dateFrom : defaultStart;
    const dateTo = isValidDate(rawFilters.dateTo) ? rawFilters.dateTo : defaultEnd;
    const safeFrom = dateFrom <= dateTo ? dateFrom : defaultStart;
    const safeTo = dateFrom <= dateTo ? dateTo : defaultEnd;
    const spanDays = getDaySpan(safeFrom, safeTo);
    const prevEnd = shiftIsoDate(safeFrom, -1);
    const prevStart = shiftIsoDate(prevEnd, -(spanDays - 1));

    const [currentRows, prevRows, trendRows, paymentRows, returnProductRows, hourRows] = await Promise.all([
      // 1. Current period daily totals
      query(
        `SELECT sale_date::text, total_sales_amount, total_units_sold, ticket_count, avg_ticket_amount
         FROM store_pipeline.rpt_daily_sales
         WHERE sale_date BETWEEN $1 AND $2
         ORDER BY sale_date`,
        [safeFrom, safeTo]
      ),

      // 2. Previous period total for delta
      query(
        `SELECT COALESCE(SUM(total_sales_amount), 0) AS prev_sales
         FROM store_pipeline.rpt_daily_sales
         WHERE sale_date BETWEEN $1 AND $2`,
        [prevStart, prevEnd]
      ),

      // 3. Trend with 7d avg and avg ticket
      query(
        `SELECT sale_date::text, total_sales_amount, ticket_count,
                sales_7d_avg, avg_ticket_amount, avg_ticket_7d_avg
         FROM store_pipeline.rpt_sales_trend_daily
         WHERE sale_date BETWEEN $1 AND $2
         ORDER BY sale_date`,
        [safeFrom, safeTo]
      ),

      // 4. Payment mix grouped by credit flag
      query(
        `SELECT CASE WHEN is_credit = 1 THEN 'Credit' ELSE 'Cash / Other' END AS payment_label,
                SUM(sales_amount) AS total_sales,
                SUM(ticket_count) AS total_tickets
         FROM store_pipeline.rpt_payment_mix_daily
         WHERE receipt_date BETWEEN $1 AND $2
         GROUP BY 1
         ORDER BY 1`,
        [safeFrom, safeTo]
      ),

      // 5. Top 20 returning products by return amount
      query(
        `SELECT item_id, item_name, product_category_name,
                SUM(return_qty) AS total_return_qty,
                SUM(return_amount) AS total_return_amount,
                SUM(return_ticket_count) AS total_return_tickets
         FROM store_pipeline.rpt_returns_analysis_daily
         WHERE receipt_date BETWEEN $1 AND $2
         GROUP BY item_id, item_name, product_category_name
         ORDER BY total_return_amount DESC NULLS LAST
         LIMIT 20`,
        [safeFrom, safeTo]
      ),

      // 6. Hourly sales aggregated across the period
      query(
        `SELECT sales_hour,
                SUM(sales_amount) AS total_sales,
                SUM(ticket_count) AS total_tickets,
                AVG(avg_ticket_amount) AS avg_ticket
         FROM store_pipeline.rpt_sales_by_hour
         WHERE receipt_date BETWEEN $1 AND $2
         GROUP BY sales_hour
         ORDER BY sales_hour`,
        [safeFrom, safeTo]
      ),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const totalSales = currentRows.reduce((s, r) => s + toNumber(r.total_sales_amount), 0);
    const totalUnitsSold = currentRows.reduce((s, r) => s + toNumber(r.total_units_sold), 0);
    const totalTickets = currentRows.reduce((s, r) => s + toNumber(r.ticket_count), 0);
    const avgTicketAmount = totalTickets > 0 ? totalSales / totalTickets : 0;
    const prevTotalSales = toNumber(prevRows[0]?.prev_sales);
    const salesDeltaPct = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : null;

    const totalReturnAmount = returnProductRows.reduce((s, r) => s + toNumber(r.total_return_amount), 0);
    const returnRate = totalSales > 0 ? (totalReturnAmount / totalSales) * 100 : null;

    const creditRow = paymentRows.find(r => r.payment_label === 'Credit');
    const creditSales = creditRow ? toNumber(creditRow.total_sales) : 0;
    const creditShare = totalSales > 0 ? (creditSales / totalSales) * 100 : null;

    // ── Trend series ──────────────────────────────────────────────────────────
    const salesTrend = trendRows.map(row => ({
      date: toIsoDate(row.sale_date),
      sales: toNumber(row.total_sales_amount),
      avg7d: row.sales_7d_avg != null ? toNumber(row.sales_7d_avg) : undefined,
    }));

    const avgTicketTrend = trendRows.map(row => ({
      date: toIsoDate(row.sale_date),
      avgTicket: toNumber(row.avg_ticket_amount),
      avg7d: row.avg_ticket_7d_avg != null ? toNumber(row.avg_ticket_7d_avg) : undefined,
    }));

    // ── Payment mix for donut ─────────────────────────────────────────────────
    const PAYMENT_COLORS = { 'Credit': '#6366f1', 'Cash / Other': '#22d3ee' };
    const totalPaymentSales = paymentRows.reduce((s, r) => s + toNumber(r.total_sales), 0);
    const paymentMix = paymentRows.map(row => ({
      key: row.payment_label,
      label: row.payment_label,
      value: toNumber(row.total_sales),
      color: PAYMENT_COLORS[row.payment_label] || '#94a3b8',
      share: totalPaymentSales > 0 ? (toNumber(row.total_sales) / totalPaymentSales) * 100 : 0,
    }));

    // ── Returns ───────────────────────────────────────────────────────────────
    const returnsByProduct = returnProductRows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      returnQty: toNumber(row.total_return_qty),
      returnAmount: toNumber(row.total_return_amount),
      returnTickets: toNumber(row.total_return_tickets),
    }));

    // ── Hourly breakdown ──────────────────────────────────────────────────────
    const hourlyBreakdown = hourRows.map(row => ({
      hour: toNumber(row.sales_hour),
      label: `${String(toNumber(row.sales_hour)).padStart(2, '0')}:00`,
      totalSales: toNumber(row.total_sales),
      totalTickets: toNumber(row.total_tickets),
      avgTicket: row.avg_ticket != null ? toNumber(row.avg_ticket) : 0,
    }));

    return {
      currentPeriod: { start: safeFrom, end: safeTo, days: spanDays },
      previousPeriod: { start: prevStart, end: prevEnd, days: spanDays },
      kpis: { totalSales, salesDeltaPct, totalUnitsSold, totalTickets, avgTicketAmount, returnRate, creditShare },
      salesTrend,
      avgTicketTrend,
      paymentMix,
      hourlyBreakdown,
      returnsByProduct,
    };
  } catch (e) {
    console.error('[dashboardData] fetchSalesDashboardData error:', e.message);
    return EMPTY;
  }
}

// ─── Products & Categories tab fetch ─────────────────────────────────────────
async function fetchProductsDashboardData_core() {
  const EMPTY = {
    kpis: { topProductByRevenue: null, topProductByUnits: null, deadStockCount: 0, topCategoryByRevenue: null, topCategoryByProfit: null },
    topProducts: [],
    slowMovers: [],
    categoryData: [],
    scatterData: [],
  };

  try {
    const [topProdRows, slowMoverRows, categoryRows, scatterRows, aggRows] = await Promise.all([
      // Top 10 products by 30d revenue rank
      query(
        `SELECT item_id, item_name, product_category_name,
                sales_amount_30d, units_sold_30d, sold_qty_30d,
                estimated_gross_profit_30d, current_inventory_qty,
                velocity_band, stock_status, sales_rank_30d
         FROM store_pipeline.rpt_product_performance_30d
         ORDER BY sales_rank_30d ASC NULLS LAST
         LIMIT 10`
      ),

      // Bottom 20: dead + slow movers (most stock, least sold)
      query(
        `SELECT item_id, item_name, product_category_name,
                sales_amount_30d, sold_qty_30d, current_inventory_qty,
                days_of_cover_30d, velocity_band, stock_status
         FROM store_pipeline.rpt_product_performance_30d
         WHERE velocity_band IN ('SLOW', 'NO_RECENT_SALES', 'OUT_OF_STOCK')
         ORDER BY sold_qty_30d ASC NULLS FIRST, current_inventory_qty DESC NULLS LAST
         LIMIT 20`
      ),

      // All categories for treemap + ranking
      query(
        `SELECT product_category_name,
                sales_amount_30d, units_sold_30d, estimated_gross_profit_30d,
                avg_days_of_cover_30d, out_of_stock_count, dead_stock_count,
                category_sales_rank_30d, category_profit_rank_30d
         FROM store_pipeline.rpt_category_performance_30d
         ORDER BY category_sales_rank_30d ASC NULLS LAST`
      ),

      // Top 100 for scatter: sales vs estimated GP
      query(
        `SELECT item_id, item_name, product_category_name,
                sales_amount_30d, estimated_gross_profit_30d,
                units_sold_30d, velocity_band
         FROM store_pipeline.rpt_product_performance_30d
         WHERE sales_amount_30d > 0
         ORDER BY sales_rank_30d ASC NULLS LAST
         LIMIT 100`
      ),

      // Aggregate: dead stock count
      query(
        `SELECT COUNT(*) FILTER (WHERE velocity_band IN ('NO_RECENT_SALES','SLOW','OUT_OF_STOCK')) AS dead_stock_count
         FROM store_pipeline.rpt_product_performance_30d`
      ),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const topByRevenue = topProdRows[0] || null;
    const topByUnits = [...topProdRows]
      .sort((a, b) => toNumber(b.units_sold_30d) - toNumber(a.units_sold_30d))[0] || null;
    const deadStockCount = toNumber(aggRows[0]?.dead_stock_count);
    const topCatByRevenue = categoryRows[0] || null;
    const topCatByProfit = [...categoryRows]
      .sort((a, b) => toNumber(b.estimated_gross_profit_30d) - toNumber(a.estimated_gross_profit_30d))[0] || null;

    // ── Top products (same format as Overview for OverviewTopProductsChart reuse) ──
    const topProducts = topProdRows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      salesAmount30d: toNumber(row.sales_amount_30d),
      unitsSold30d: toNumber(row.units_sold_30d),
      soldQty30d: toNumber(row.sold_qty_30d),
      estimatedGrossProfit30d: toNumber(row.estimated_gross_profit_30d),
      currentInventoryQty: toNumber(row.current_inventory_qty),
      velocityBand: row.velocity_band || '—',
      stockStatus: normalizeStatusLabel(row.stock_status),
    }));

    // ── Slow movers ───────────────────────────────────────────────────────────
    const slowMovers = slowMoverRows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      salesAmount30d: toNumber(row.sales_amount_30d),
      soldQty30d: toNumber(row.sold_qty_30d),
      inventoryQty: toNumber(row.current_inventory_qty),
      daysOfCover30d: row.days_of_cover_30d != null ? toNumber(row.days_of_cover_30d) : null,
      velocityBand: row.velocity_band || '—',
      stockStatus: normalizeStatusLabel(row.stock_status),
    }));

    // ── Category data for treemap + table ─────────────────────────────────────
    const TREEMAP_COLORS = [
      '#6366f1','#22d3ee','#22c55e','#f59e0b','#ef4444',
      '#a855f7','#ec4899','#14b8a6','#f97316','#84cc16',
      '#06b6d4','#8b5cf6','#10b981','#fb923c','#4ade80',
      '#0ea5e9','#d946ef','#f43f5e','#a3e635','#38bdf8',
    ];
    const categoryData = categoryRows.map((row, i) => ({
      name: row.product_category_name || '—',
      value: toNumber(row.sales_amount_30d),
      profit: toNumber(row.estimated_gross_profit_30d),
      unitsSold: toNumber(row.units_sold_30d),
      avgDaysOfCover: row.avg_days_of_cover_30d != null ? toNumber(row.avg_days_of_cover_30d) : null,
      outOfStockCount: toNumber(row.out_of_stock_count),
      deadStockCount: toNumber(row.dead_stock_count),
      salesRank: toNumber(row.category_sales_rank_30d),
      profitRank: toNumber(row.category_profit_rank_30d),
      color: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
    }));

    // ── Scatter data ──────────────────────────────────────────────────────────
    const scatterData = scatterRows.map(row => ({
      itemId: row.item_id,
      itemName: row.item_name || `Product #${row.item_id}`,
      categoryName: row.product_category_name || '—',
      salesAmount: toNumber(row.sales_amount_30d),
      grossProfit: toNumber(row.estimated_gross_profit_30d),
      unitsSold: toNumber(row.units_sold_30d),
      velocityBand: row.velocity_band || 'unknown',
    }));

    return {
      kpis: {
        topProductByRevenue: topByRevenue ? {
          itemName: topByRevenue.item_name,
          salesAmount: toNumber(topByRevenue.sales_amount_30d),
          categoryName: topByRevenue.product_category_name || '—',
        } : null,
        topProductByUnits: topByUnits ? {
          itemName: topByUnits.item_name,
          unitsSold: toNumber(topByUnits.units_sold_30d),
          categoryName: topByUnits.product_category_name || '—',
        } : null,
        deadStockCount,
        topCategoryByRevenue: topCatByRevenue ? {
          categoryName: topCatByRevenue.product_category_name,
          salesAmount: toNumber(topCatByRevenue.sales_amount_30d),
        } : null,
        topCategoryByProfit: topCatByProfit ? {
          categoryName: topCatByProfit.product_category_name,
          profitAmount: toNumber(topCatByProfit.estimated_gross_profit_30d),
        } : null,
      },
      topProducts,
      slowMovers,
      categoryData,
      scatterData,
    };
  } catch (e) {
    console.error('[dashboardData] fetchProductsDashboardData error:', e.message);
    return EMPTY;
  }
}

// ─── Cached wrappers (Supabase load reduction) ──────────────────────────────────
// The dashboard is a Server Component with no per-page caching, so every visit
// previously fired a fresh burst of queries at Supabase — a direct Disk-IO cost.
// unstable_cache stores each result in the Next.js Data Cache keyed by the
// function name + its arguments (filter object), so repeated views of the same
// tab/filter combination are served from cache instead of re-querying.
//
// Data only changes when the dbt pipeline reloads, so a 30-min TTL on tab data
// and a 1-day TTL on the (rarely-changing) filter options is safe. Invalidate
// early with `revalidateTag('dashboard')` after a pipeline run if needed.
const DASHBOARD_TTL = 1800;   // 30 minutes
const FILTER_TTL = 86400;     // 24 hours

export const fetchOverviewDashboardData = unstable_cache(
  fetchOverviewDashboardData_core,
  ['overview-dashboard'],
  { revalidate: DASHBOARD_TTL, tags: ['dashboard'] }
);
export const fetchSalesDashboardData = unstable_cache(
  fetchSalesDashboardData_core,
  ['sales-dashboard'],
  { revalidate: DASHBOARD_TTL, tags: ['dashboard'] }
);
export const fetchInventoryDashboardData = unstable_cache(
  fetchInventoryDashboardData_core,
  ['inventory-dashboard'],
  { revalidate: DASHBOARD_TTL, tags: ['dashboard'] }
);
export const fetchProductsDashboardData = unstable_cache(
  fetchProductsDashboardData_core,
  ['products-dashboard'],
  { revalidate: DASHBOARD_TTL, tags: ['dashboard'] }
);
export const fetchOverviewFilterOptions = unstable_cache(
  fetchOverviewFilterOptions_core,
  ['overview-filter-options'],
  { revalidate: FILTER_TTL, tags: ['dashboard'] }
);
