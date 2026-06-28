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
    _pool = new Pool({
      connectionString: process.env.NEXT_DATABASE_URL,
      // DB_POOL_MAX is env-tunable (clamped to >=1) so max=1 can be tested on Vercel.
      max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
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

// Defensive query for tables that may not be deployed to prod yet
// (e.g. rpt_sales_by_hour_weekday, rpt_staffing_vs_sales_by_hour on DEV only).
// A missing-table / any query error logs and returns [] so the caller keeps
// rendering instead of throwing the whole tab.
async function queryOptional(sql, params = [], label = 'optional query') {
  try {
    return await query(sql, params);
  } catch (e) {
    console.error(`[dashboardData] ${label} failed (returning []):`, e.message);
    return [];
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

    // Top products by 30d revenue (has item_name/category directly — no join needed).
    // T3: widened from LIMIT 10 → 50 so the UI can filter this pool by category
    // client-side (each row carries categoryName) and still show its top 10.
    query(
      `SELECT item_id, item_name, product_category_name,
              sales_amount_30d, units_sold_30d, sold_qty_30d,
              estimated_gross_profit_30d, current_inventory_qty,
              velocity_band, stock_status
       FROM store_pipeline.rpt_product_performance_30d
       ORDER BY sales_amount_30d DESC NULLS LAST
       LIMIT 50`
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
  const deadStockCount = invCountMap['DEAD_STOCK'] ?? 0;

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
      deadStockCount,
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

    // T2 — cascading category→item map. Derived from the same
    // (product_category_name, item_name) rows so the UI can show only the items
    // in the selected category. Each category → de-duplicated, sorted item list.
    const itemsByCategory = {};
    for (const r of productRows) {
      const cat = r.product_category_name;
      const item = r.item_name;
      if (!cat || !item) continue;
      (itemsByCategory[cat] ||= new Set()).add(item);
    }
    for (const cat of Object.keys(itemsByCategory)) {
      itemsByCategory[cat] = [...itemsByCategory[cat]].sort();
    }

    return {
      productCategories: categories,
      itemNames,
      itemsByCategory,
      stockStatuses: stockStatuses.map((v) => ({ value: v, label: normalizeStatusLabel(v) })),
      velocityBands: velocityBands.map((v) => ({ value: v, label: normalizeStatusLabel(v) })),
    };
  } catch (e) {
    console.error('[dashboardData] fetchOverviewFilterOptions error:', e.message);
    return { productCategories: [], itemNames: [], itemsByCategory: {}, stockStatuses: [], velocityBands: [] };
  }
}

// ─── Inventory tab fetch ──────────────────────────────────────────────────────
async function fetchInventoryDashboardData_core(filters = {}) {
  const EMPTY = {
    snapshotDate: null,
    kpis: { totalItems: 0, outOfStockCount: 0, stockoutRiskCount: 0, overstockCount: 0, deadStockCount: 0, avgDaysOfCover: null },
    inventoryDistribution: [],
    coverHistogram: [],
    scatterData: [],
    reorderItems: [],
    overstockItems: [],
    deadStockItems: [],
    healthTrend: [],
    healthTrendSummary: {
      latestDate: null,
      depthDays: 0,
      atRiskLatest: 0,
      atRiskWowDelta: null,
      avgDaysOfCoverLatest: 0,
      stockoutRiskLatest: 0,
    },
    trendPeriod: { start: null, end: null, label: 'All time', scoped: false },
  };

  // Only the health-trend series is date-scoped; all snapshot widgets stay "latest".
  const dateFrom = isValidDate(filters.dateFrom) ? filters.dateFrom : null;
  const dateTo = isValidDate(filters.dateTo) ? filters.dateTo : null;
  const trendScoped = !!(dateFrom || dateTo);

  // T1 — stock_status / velocity_band item-level filters. Values arrive UPPERCASE
  // from the filter-options (DISTINCT of the same columns); compare with UPPERCASE
  // literals. These are applied to the row-level (item) queries only — the scatter,
  // the reorder/overstock action list, and the dead-stock list. The aggregate
  // snapshot KPIs and the status-distribution donut are intentionally left whole
  // (they describe the entire snapshot).
  const stockStatusFilter = trimOrNull(filters.stockStatus);
  const velocityBandFilter = trimOrNull(filters.velocityBand);

  // Builds an item-level filter predicate over a given column-alias, starting at
  // placeholder index `startIdx`. Each piece is parameterized (no interpolation).
  function itemFilterPredicate(startIdx, { statusCol, velocityCol } = {}) {
    const parts = [];
    const params = [];
    let i = startIdx;
    if (stockStatusFilter && statusCol) { parts.push(`AND ${statusCol} = $${i++}`); params.push(stockStatusFilter); }
    if (velocityBandFilter && velocityCol) { parts.push(`AND ${velocityCol} = $${i++}`); params.push(velocityBandFilter); }
    return { sql: parts.join(' '), params };
  }

  try {
    // Scatter: rpt_product_velocity carries velocity_band but NOT stock_status —
    // only the velocity filter can be applied here.
    const scatterFilter = itemFilterPredicate(1, { statusCol: null, velocityCol: 'pv.velocity_band' });
    // Action list: rpt_inventory_actions (ia) carries both columns.
    const actionFilter = itemFilterPredicate(1, { statusCol: 'ia.stock_status', velocityCol: 'ia.velocity_band' });
    // Dead-stock list: rpt_inventory_risk (r) carries both columns. (The base query
    // already pins velocity_band='NO_RECENT_SALES'; a velocity filter narrows further.)
    const deadFilter = itemFilterPredicate(1, { statusCol: 'r.stock_status', velocityCol: 'r.velocity_band' });

    const [riskRows, histRows, scatterRows, actionRows, deadRows, healthTrendRows, execDocRows] = await Promise.all([
      // KPI aggregation: count by status (× velocity kept for distribution parity)
      query(
        `SELECT snapshot_date::text, stock_status, velocity_band, COUNT(*) AS cnt
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
           -- ITEM 4: exclude junk/placeholder products
           AND dp.item_name IS NOT NULL
           AND btrim(dp.item_name) <> ''
           AND dp.item_id <> '/'
           AND lower(btrim(dp.item_name)) <> 'unknown item'
           ${scatterFilter.sql}
         ORDER BY pv.sold_qty_30d DESC NULLS LAST
         LIMIT 200`,
        scatterFilter.params
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
           -- ITEM 4: exclude junk/placeholder products (e.g. item_id '/', "Unknown Item")
           AND dp.item_name IS NOT NULL
           AND btrim(dp.item_name) <> ''
           AND dp.item_id <> '/'
           AND lower(btrim(dp.item_name)) <> 'unknown item'
           ${actionFilter.sql}
         ORDER BY ia.action_priority ASC NULLS LAST, ia.item_id`,
        actionFilter.params
      ),

      // Dead stock: items with near-zero movement from inventory risk
      query(
        `SELECT r.item_id, dp.item_name, dp.category_name AS product_category_name,
                r.stock_status, r.current_inventory_qty, r.days_of_cover_30d, r.velocity_band
         FROM store_pipeline.rpt_inventory_risk r
         JOIN store_pipeline.dim_product dp USING (item_id)
         WHERE r.snapshot_date = (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_risk)
           AND r.velocity_band = 'NO_RECENT_SALES'
           -- ITEM 4: exclude junk/placeholder products (e.g. item_id '/', "Unknown Item")
           AND dp.item_name IS NOT NULL
           AND btrim(dp.item_name) <> ''
           AND dp.item_id <> '/'
           AND lower(btrim(dp.item_name)) <> 'unknown item'
           ${deadFilter.sql}
         ORDER BY r.current_inventory_qty DESC NULLS LAST
         LIMIT 50`,
        deadFilter.params
      ),

      // Inventory health trend: daily time-series, scoped to [dateFrom,dateTo] when set
      // (missing side falls back to the series min/max via COALESCE).
      query(
        `SELECT snapshot_date::text, items_count, out_of_stock_count, stockout_risk_count,
                dead_stock_count, overstock_count, healthy_count, at_risk_count,
                total_inventory_units, avg_days_of_cover_30d, at_risk_7d_avg, at_risk_wow_delta
         FROM store_pipeline.rpt_inventory_health_trend
         WHERE snapshot_date BETWEEN
               COALESCE($1::timestamp, (SELECT MIN(snapshot_date) FROM store_pipeline.rpt_inventory_health_trend))
           AND COALESCE($2::timestamp, (SELECT MAX(snapshot_date) FROM store_pipeline.rpt_inventory_health_trend))
         ORDER BY snapshot_date ASC`,
        [dateFrom, dateTo]
      ),

      // Canonical avg days of cover — the same pipeline mart value Overview reads
      // (single source of truth; see ITEM 2b).
      query(
        `SELECT avg_days_of_cover_30d
         FROM store_pipeline.rpt_executive_summary_daily
         ORDER BY sale_date DESC
         LIMIT 1`
      ),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    let totalItems = 0, outOfStockCount = 0, stockoutRiskCount = 0, overstockCount = 0, deadStockCount = 0;
    const statusMap = {};

    for (const row of riskRows) {
      const cnt = toNumber(row.cnt);
      const status = String(row.stock_status || '').toLowerCase();

      totalItems += cnt;
      statusMap[status] = (statusMap[status] || 0) + cnt;

      if (status === 'out_of_stock') outOfStockCount += cnt;
      if (status === 'stockout_risk') stockoutRiskCount += cnt;
      if (status === 'overstock') overstockCount += cnt;
      // ITEM 2a (unified): "Dead stock" = stock_status='DEAD_STOCK' — same definition
      // as Overview's invCountMap['DEAD_STOCK']. (Previously counted velocity_band
      // 'NO_RECENT_SALES', a different metric.)
      if (status === 'dead_stock') deadStockCount += cnt;
    }

    // ITEM 2b (unified): "Avg days of cover" uses the canonical pipeline mart value
    // rpt_executive_summary_daily.avg_days_of_cover_30d — the SAME source Overview
    // reads — instead of the ad-hoc weighted-avg-excluding-nulls recompute (which
    // gave a different number, e.g. 183 vs the mart's 133).
    const avgDaysOfCover = execDocRows[0]?.avg_days_of_cover_30d != null
      ? toNumber(execDocRows[0].avg_days_of_cover_30d)
      : null;
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

    // ── Inventory health trend (time-series) ──────────────────────────────────
    const healthTrend = healthTrendRows.map(row => ({
      date: toIsoDate(row.snapshot_date),
      itemsCount: toNumber(row.items_count),
      outOfStock: toNumber(row.out_of_stock_count),
      stockoutRisk: toNumber(row.stockout_risk_count),
      deadStock: toNumber(row.dead_stock_count),
      overstock: toNumber(row.overstock_count),
      healthy: toNumber(row.healthy_count),
      atRisk: toNumber(row.at_risk_count),
      atRisk7dAvg: toNumber(row.at_risk_7d_avg),
      avgDaysOfCover: toNumber(row.avg_days_of_cover_30d),
      totalUnits: toNumber(row.total_inventory_units),
    }));

    const lastTrendRow = healthTrendRows[healthTrendRows.length - 1] || null;
    const healthTrendSummary = {
      latestDate: lastTrendRow ? toIsoDate(lastTrendRow.snapshot_date) : null,
      depthDays: healthTrend.length,
      atRiskLatest: lastTrendRow ? toNumber(lastTrendRow.at_risk_count) : 0,
      atRiskWowDelta: lastTrendRow && lastTrendRow.at_risk_wow_delta != null
        ? toNumber(lastTrendRow.at_risk_wow_delta)
        : null,
      avgDaysOfCoverLatest: lastTrendRow ? toNumber(lastTrendRow.avg_days_of_cover_30d) : 0,
      stockoutRiskLatest: lastTrendRow ? toNumber(lastTrendRow.stockout_risk_count) : 0,
    };

    // Derive the trend's actual span from the returned (possibly filtered) series.
    const trendStart = healthTrend[0]?.date ?? null;
    const trendEnd = healthTrend[healthTrend.length - 1]?.date ?? null;
    const trendPeriod = {
      start: trendStart,
      end: trendEnd,
      label: trendScoped ? formatWorkforcePeriodLabel(trendStart, trendEnd) : 'All time',
      scoped: trendScoped,
    };

    return { snapshotDate, kpis: { totalItems, outOfStockCount, stockoutRiskCount, overstockCount, deadStockCount, avgDaysOfCover }, inventoryDistribution, coverHistogram, scatterData, reorderItems, overstockItems, deadStockItems, healthTrend, healthTrendSummary, trendPeriod };
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
    kpis: {
      totalSales: 0, salesDeltaPct: null,
      totalUnitsSold: 0, unitsDeltaPct: null,
      totalTickets: 0, ticketsDeltaPct: null,
      avgTicketAmount: 0, avgTicketDeltaPct: null,
      returnRate: null, returnRateDeltaPct: null,
      creditShare: null,
    },
    salesTrend: [],
    avgTicketTrend: [],
    paymentMix: [],
    hourlyBreakdown: [],
    returnsByProduct: [],
    hourWeekdayHeatmap: [],
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

    const [currentRows, prevRows, trendRows, paymentRows, returnProductRows, hourRows, heatmapRows, prevReturnRows] = await Promise.all([
      // 1. Current period daily totals
      query(
        `SELECT sale_date::text, total_sales_amount, total_units_sold, ticket_count, avg_ticket_amount
         FROM store_pipeline.rpt_daily_sales
         WHERE sale_date BETWEEN $1 AND $2
         ORDER BY sale_date`,
        [safeFrom, safeTo]
      ),

      // 2. Previous period aggregates (all KPIs, for prior-period deltas — #10)
      query(
        `SELECT COALESCE(SUM(total_sales_amount), 0) AS prev_sales,
                COALESCE(SUM(total_units_sold), 0)   AS prev_units,
                COALESCE(SUM(ticket_count), 0)       AS prev_tickets
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

      // 5. Top returning products by return amount.
      // T4: widened from LIMIT 20 → 50 so the UI can filter this pool by category
      // client-side (each row carries categoryName) and still show its top 20.
      query(
        `SELECT item_id, item_name, product_category_name,
                SUM(return_qty) AS total_return_qty,
                SUM(return_amount) AS total_return_amount,
                SUM(return_ticket_count) AS total_return_tickets
         FROM store_pipeline.rpt_returns_analysis_daily
         WHERE receipt_date BETWEEN $1 AND $2
         GROUP BY item_id, item_name, product_category_name
         ORDER BY total_return_amount DESC NULLS LAST
         LIMIT 50`,
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

      // 7. Hour × weekday heatmap (#12). Source table not yet deployed to prod —
      // queryOptional falls back to [] so the tab keeps rendering until it lands.
      queryOptional(
        `SELECT day_of_week, day_name, sales_hour,
                net_sales_amount, tickets_count, occurrences
         FROM store_pipeline.rpt_sales_by_hour_weekday
         ORDER BY day_of_week, sales_hour`,
        [],
        'rpt_sales_by_hour_weekday'
      ),

      // 8. Previous-period returns total for returnRateDeltaPct (#10)
      query(
        `SELECT COALESCE(SUM(return_amount), 0) AS prev_return_amount
         FROM store_pipeline.rpt_returns_analysis_daily
         WHERE receipt_date BETWEEN $1 AND $2`,
        [prevStart, prevEnd]
      ),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const totalSales = currentRows.reduce((s, r) => s + toNumber(r.total_sales_amount), 0);
    const totalUnitsSold = currentRows.reduce((s, r) => s + toNumber(r.total_units_sold), 0);
    const totalTickets = currentRows.reduce((s, r) => s + toNumber(r.ticket_count), 0);
    const avgTicketAmount = totalTickets > 0 ? totalSales / totalTickets : 0;
    // Prior-period deltas (#10): (current − previous) / previous * 100, null when previous is 0/null.
    const pctDelta = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : null);

    const prevTotalSales = toNumber(prevRows[0]?.prev_sales);
    const prevTotalUnits = toNumber(prevRows[0]?.prev_units);
    const prevTotalTickets = toNumber(prevRows[0]?.prev_tickets);
    const prevAvgTicket = prevTotalTickets > 0 ? prevTotalSales / prevTotalTickets : 0;

    const salesDeltaPct = pctDelta(totalSales, prevTotalSales);
    const unitsDeltaPct = pctDelta(totalUnitsSold, prevTotalUnits);
    const ticketsDeltaPct = pctDelta(totalTickets, prevTotalTickets);
    const avgTicketDeltaPct = pctDelta(avgTicketAmount, prevAvgTicket);

    const totalReturnAmount = returnProductRows.reduce((s, r) => s + toNumber(r.total_return_amount), 0);
    const returnRate = totalSales > 0 ? (totalReturnAmount / totalSales) * 100 : null;

    // returnRateDeltaPct compares return RATE (returns/sales) period over period.
    const prevReturnAmount = toNumber(prevReturnRows[0]?.prev_return_amount);
    const prevReturnRate = prevTotalSales > 0 ? (prevReturnAmount / prevTotalSales) * 100 : null;
    const returnRateDeltaPct =
      prevReturnRate != null && prevReturnRate > 0 && returnRate != null
        ? ((returnRate - prevReturnRate) / prevReturnRate) * 100
        : null;

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

    // ── Hour × weekday heatmap (#12) ──────────────────────────────────────────
    const hourWeekdayHeatmap = heatmapRows.map(row => {
      const netSales = toNumber(row.net_sales_amount);
      const occurrences = toNumber(row.occurrences);
      return {
        dayOfWeek: toNumber(row.day_of_week),
        dayName: row.day_name || '—',
        hour: toNumber(row.sales_hour),
        netSales,
        tickets: toNumber(row.tickets_count),
        occurrences,
        avgPerOccurrence: occurrences > 0 ? netSales / occurrences : 0,
      };
    });

    return {
      currentPeriod: { start: safeFrom, end: safeTo, days: spanDays },
      previousPeriod: { start: prevStart, end: prevEnd, days: spanDays },
      kpis: {
        totalSales, salesDeltaPct,
        totalUnitsSold, unitsDeltaPct,
        totalTickets, ticketsDeltaPct,
        avgTicketAmount, avgTicketDeltaPct,
        returnRate, returnRateDeltaPct,
        creditShare,
      },
      salesTrend,
      avgTicketTrend,
      paymentMix,
      hourlyBreakdown,
      returnsByProduct,
      hourWeekdayHeatmap,
    };
  } catch (e) {
    console.error('[dashboardData] fetchSalesDashboardData error:', e.message);
    return EMPTY;
  }
}

// ─── Products & Categories tab fetch ─────────────────────────────────────────
async function fetchProductsDashboardData_core(filters = {}) {
  const EMPTY = {
    kpis: { topProductByRevenue: null, topProductByUnits: null, slowAndDeadCount: 0, topCategoryByRevenue: null, topCategoryByProfit: null },
    topProducts: [],
    slowMovers: [],
    categoryData: [],
    scatterData: [],
    period: { start: null, end: null, label: '30-day rolling', scoped: false },
  };

  // When a date range is set, sales/units/category views are re-aggregated from the
  // daily fact over [dateFrom,dateTo]; GP scatter + slow-movers stay 30-day rolling
  // (GP / velocity_band only exist in the 30d marts, not in the daily fact).
  const dateFrom = isValidDate(filters.dateFrom) ? filters.dateFrom : null;
  const dateTo = isValidDate(filters.dateTo) ? filters.dateTo : null;
  const scoped = !!(dateFrom || dateTo);

  // T1 — stock_status / velocity_band product-level filters. Values arrive
  // UPPERCASE; compare with UPPERCASE literals. rpt_product_performance_30d carries
  // both columns, so both filters apply to top products, slow movers, and the
  // scatter. The category-ranking aggregate (rpt_category_performance_30d) has no
  // per-item status/velocity column, so it is intentionally left unfiltered.
  const stockStatusFilter = trimOrNull(filters.stockStatus);
  const velocityBandFilter = trimOrNull(filters.velocityBand);

  // Parameterized predicate over rpt_product_performance_30d columns, starting at
  // placeholder index `startIdx`.
  function productFilterPredicate(startIdx) {
    const parts = [];
    const params = [];
    let i = startIdx;
    if (stockStatusFilter) { parts.push(`AND stock_status = $${i++}`); params.push(stockStatusFilter); }
    if (velocityBandFilter) { parts.push(`AND velocity_band = $${i++}`); params.push(velocityBandFilter); }
    return { sql: parts.join(' '), params };
  }

  try {
    const topProdFilter = productFilterPredicate(1);
    const slowMoverFilter = productFilterPredicate(1);
    const scatterFilter = productFilterPredicate(1);

    const [topProdRows, slowMoverRows, categoryRows, scatterRows, aggRows] = await Promise.all([
      // Top 10 products by 30d revenue rank
      query(
        `SELECT item_id, item_name, product_category_name,
                sales_amount_30d, units_sold_30d, sold_qty_30d,
                estimated_gross_profit_30d, current_inventory_qty,
                velocity_band, stock_status, sales_rank_30d
         FROM store_pipeline.rpt_product_performance_30d
         WHERE TRUE ${topProdFilter.sql}
         ORDER BY sales_rank_30d ASC NULLS LAST
         LIMIT 10`,
        topProdFilter.params
      ),

      // Bottom 20: dead + slow movers (most stock, least sold)
      query(
        `SELECT item_id, item_name, product_category_name,
                sales_amount_30d, sold_qty_30d, current_inventory_qty,
                days_of_cover_30d, velocity_band, stock_status
         FROM store_pipeline.rpt_product_performance_30d
         WHERE velocity_band IN ('SLOW', 'NO_RECENT_SALES', 'OUT_OF_STOCK')
           ${slowMoverFilter.sql}
         ORDER BY sold_qty_30d ASC NULLS FIRST, current_inventory_qty DESC NULLS LAST
         LIMIT 20`,
        slowMoverFilter.params
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
           ${scatterFilter.sql}
         ORDER BY sales_rank_30d ASC NULLS LAST
         LIMIT 100`,
        scatterFilter.params
      ),

      // Aggregate: slow & dead movers count (ITEM 2 — this is a DIFFERENT metric
      // from "dead stock" — it's slow + no-recent-sales + out-of-stock movers.
      // Renamed from deadStockCount → slowAndDeadCount; UI relabels "Slow & dead movers".)
      query(
        `SELECT COUNT(*) FILTER (WHERE velocity_band IN ('NO_RECENT_SALES','SLOW','OUT_OF_STOCK')) AS slow_and_dead_count
         FROM store_pipeline.rpt_product_performance_30d`
      ),
    ]);

    // ── KPIs ──────────────────────────────────────────────────────────────────
    let topByRevenue = topProdRows[0] || null;
    let topByUnits = [...topProdRows]
      .sort((a, b) => toNumber(b.units_sold_30d) - toNumber(a.units_sold_30d))[0] || null;
    const slowAndDeadCount = toNumber(aggRows[0]?.slow_and_dead_count);
    let topCatByRevenue = categoryRows[0] || null;
    const topCatByProfit = [...categoryRows]
      .sort((a, b) => toNumber(b.estimated_gross_profit_30d) - toNumber(a.estimated_gross_profit_30d))[0] || null;

    // ── Top products (same format as Overview for OverviewTopProductsChart reuse) ──
    let topProducts = topProdRows.map(row => ({
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
    let categoryData = categoryRows.map((row, i) => ({
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

    // ── Date-range override (partial) ─────────────────────────────────────────
    // When a range is set, re-aggregate sales/units/categories from the daily fact.
    // GP scatter + slow-movers (above) stay 30-day rolling — GP/velocity aren't in
    // the daily fact. topProducts carry the item's CURRENT velocity/GP/stock (30d join).
    let period = { start: null, end: null, label: '30-day rolling', scoped: false };
    if (scoped) {
      const boundsRows = await query(
        `SELECT MIN(sale_date)::text AS mn, MAX(sale_date)::text AS mx
         FROM store_pipeline.int_sales__daily_product`
      );
      const from = dateFrom || toIsoDate(boundsRows[0]?.mn);
      const to = dateTo || toIsoDate(boundsRows[0]?.mx);
      period = { start: from, end: to, label: formatWorkforcePeriodLabel(from, to), scoped: true };

      const [rangeProdRows, rangeCatRows] = await Promise.all([
        query(
          `SELECT dp.item_id,
                  d.item_name, d.category_name AS product_category_name,
                  SUM(dp.net_sales_amount) AS sales_amount_30d,
                  SUM(dp.sold_qty)         AS units_sold_30d,
                  SUM(dp.sold_qty)         AS sold_qty_30d,
                  p.estimated_gross_profit_30d, p.current_inventory_qty,
                  p.velocity_band, p.stock_status
           FROM store_pipeline.int_sales__daily_product dp
           JOIN store_pipeline.dim_product d USING (item_id)
           LEFT JOIN store_pipeline.rpt_product_performance_30d p ON p.item_id = dp.item_id
           WHERE dp.sale_date BETWEEN $1 AND $2
           GROUP BY dp.item_id, d.item_name, d.category_name,
                    p.estimated_gross_profit_30d, p.current_inventory_qty, p.velocity_band, p.stock_status
           ORDER BY sales_amount_30d DESC NULLS LAST
           LIMIT 10`,
          [from, to]
        ),
        query(
          `SELECT d.category_name AS product_category_name,
                  SUM(dp.net_sales_amount) AS sales_amount_30d,
                  SUM(dp.sold_qty)         AS units_sold_30d
           FROM store_pipeline.int_sales__daily_product dp
           JOIN store_pipeline.dim_product d USING (item_id)
           WHERE dp.sale_date BETWEEN $1 AND $2
           GROUP BY d.category_name
           ORDER BY sales_amount_30d DESC NULLS LAST`,
          [from, to]
        ),
      ]);

      topProducts = rangeProdRows.map(row => ({
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

      categoryData = rangeCatRows.map((row, i) => ({
        name: row.product_category_name || '—',
        value: toNumber(row.sales_amount_30d),
        profit: 0,                 // GP not range-computable (only in 30d mart)
        unitsSold: toNumber(row.units_sold_30d),
        avgDaysOfCover: null,
        outOfStockCount: 0,
        deadStockCount: 0,
        salesRank: i + 1,
        profitRank: null,
        color: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
      }));

      // Range-dependent KPI source rows (alias columns match the inline return mapping).
      topByRevenue = rangeProdRows[0] || null;
      topByUnits = [...rangeProdRows]
        .sort((a, b) => toNumber(b.units_sold_30d) - toNumber(a.units_sold_30d))[0] || null;
      topCatByRevenue = rangeCatRows[0] || null;
    }

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
        slowAndDeadCount,
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
      period,
    };
  } catch (e) {
    console.error('[dashboardData] fetchProductsDashboardData error:', e.message);
    return EMPTY;
  }
}

// ─── Workforce tab ──────────────────────────────────────────────────────────────
// Headline = rpt_workforce_productivity_summary (one ranked row per employee:
// hours, overtime tiers, payroll, attributed sales, efficiency, recent form).
// Detail   = rpt_employee_productivity (per-day rows) → daily productivity trend.
// Attributed sales are estimated by worked-hour share, not direct ownership.
// Human-friendly label for a resolved [start,end] ISO range. Exact single
// calendar month → "May 2026"; otherwise "12 Apr – 24 Jun 2026" style.
function formatWorkforcePeriodLabel(start, end) {
  if (!start || !end) return 'All time';
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const lastDay = new Date(Date.UTC(sy, sm, 0)).getUTCDate(); // last day of start month
  if (sy === ey && sm === em && sd === 1 && ed === lastDay) {
    return `${MONTHS[sm - 1]} ${sy}`;
  }
  const startPart = sy === ey
    ? `${sd} ${MONTHS[sm - 1]}`
    : `${sd} ${MONTHS[sm - 1]} ${sy}`;
  return `${startPart} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

async function fetchWorkforceDashboardData_core(filters = {}) {
  const dateFrom = isValidDate(filters?.dateFrom) ? filters.dateFrom : null;
  const dateTo = isValidDate(filters?.dateTo) ? filters.dateTo : null;
  const scoped = !!(dateFrom || dateTo);

  const EMPTY = {
    employees: [],
    dailyTrend: [],
    dailyEmployeeSales: [],
    trendDays: 0,
    staffingVsSales: [],
    kpis: {
      totalAttributedSales: 0,
      totalPay: 0,
      totalHours: 0,
      totalShifts: 0,
      teamEfficiency: 0,
      blendedHourlyCost: 0,
    },
    period: { start: null, end: null, label: 'All time', scoped: false },
  };

  // Staffing vs sales by hour (#15). 24 rows, one per hour, not date-scoped.
  // Source table not yet deployed to prod — queryOptional falls back to [].
  // salesPerLabourHour is null (not 0) when labourHours≈0 so the UI can flag
  // "unstaffed trading" (overnight sales with no logged labour).
  const fetchStaffingVsSales = async () => {
    const rows = await queryOptional(
      `SELECT sales_hour, labour_hours, headcount_avg, net_sales_amount, tickets_count
       FROM store_pipeline.rpt_staffing_vs_sales_by_hour
       ORDER BY sales_hour`,
      [],
      'rpt_staffing_vs_sales_by_hour'
    );
    return rows.map(row => {
      const labourHours = toNumber(row.labour_hours);
      const netSales = toNumber(row.net_sales_amount);
      return {
        hour: toNumber(row.sales_hour),
        labourHours,
        headcountAvg: toNumber(row.headcount_avg),
        netSales,
        tickets: toNumber(row.tickets_count),
        salesPerLabourHour: labourHours > 0 ? netSales / labourHours : null,
      };
    });
  };

  // Team KPIs from a set of mapped employee objects (shared by both branches).
  const computeKpis = (employees) => {
    const totalAttributedSales = employees.reduce((s, e) => s + e.attributedSales, 0);
    const totalPay = employees.reduce((s, e) => s + e.totalPay, 0);
    const totalHours = employees.reduce((s, e) => s + e.totalHours, 0);
    const totalShifts = employees.reduce((s, e) => s + e.totalShifts, 0);
    return {
      totalAttributedSales,
      totalPay,
      totalHours,
      totalShifts,
      teamEfficiency: totalPay > 0 ? totalAttributedSales / totalPay : 0,
      blendedHourlyCost: totalHours > 0 ? totalPay / totalHours : 0,
    };
  };

  // T5 — per-day per-employee attributed sales for a stacked-by-employee daily bar.
  // Grain shift_date × employee_id from rpt_employee_productivity. Restricted to a
  // readable recent window: the [dateFrom,dateTo] filter when valid, otherwise the
  // last 30 distinct shift_dates present in the table. employee_name is Hebrew —
  // passed through untouched (UI renders RTL). Ordered by date asc.
  const fetchDailyEmployeeSales = async () => {
    const rows = (dateFrom || dateTo)
      ? await query(
          `SELECT shift_date::text, employee_id, employee_name, sales_amount
           FROM store_pipeline.rpt_employee_productivity
           WHERE shift_date BETWEEN
                 COALESCE($1::date, (SELECT MIN(shift_date) FROM store_pipeline.rpt_employee_productivity))
             AND COALESCE($2::date, (SELECT MAX(shift_date) FROM store_pipeline.rpt_employee_productivity))
           ORDER BY shift_date ASC, employee_id ASC`,
          [dateFrom, dateTo]
        )
      : await query(
          `SELECT shift_date::text, employee_id, employee_name, sales_amount
           FROM store_pipeline.rpt_employee_productivity
           WHERE shift_date IN (
             SELECT DISTINCT shift_date
             FROM store_pipeline.rpt_employee_productivity
             ORDER BY shift_date DESC
             LIMIT 30
           )
           ORDER BY shift_date ASC, employee_id ASC`
        );
    return rows.map((r) => ({
      date: toIsoDate(r.shift_date),
      employeeId: String(r.employee_id),
      employeeName: r.employee_name || `Employee #${r.employee_id}`,
      sales: toNumber(r.sales_amount),
    }));
  };

  try {
    if (!scoped) {
      // ── Unscoped: unchanged all-time logic (summary table + last-30 trend) ──
      const [summaryRows, dailyRows, boundsRows, staffingVsSales, dailyEmployeeSales] = await Promise.all([
        // One row per employee, pre-ranked by the pipeline.
        query(
          `SELECT employee_id, employee_name, total_shifts, total_hours,
                  regular_hours, ot125_hours, ot150_hours, hourly_rate,
                  total_pay, avg_hourly_cost, attributed_sales,
                  sales_per_labor_shekel, avg_daily_sales_7d, avg_daily_hours_7d,
                  sales_rank, hours_rank, efficiency_rank
           FROM store_pipeline.rpt_workforce_productivity_summary
           ORDER BY sales_rank ASC`
        ),
        // Per-day detail for the trailing window (drives the trend line).
        query(
          `SELECT shift_date::text, employee_id, employee_name,
                  hours_worked, shift_count, sales_amount, sales_per_hour
           FROM store_pipeline.rpt_employee_productivity
           WHERE shift_date >= (
             SELECT MAX(shift_date) - INTERVAL '30 days'
             FROM store_pipeline.rpt_employee_productivity
           )
           ORDER BY shift_date ASC, employee_id ASC`
        ),
        // ITEM 3: the all-time span the summary covers — surfaced so the tab can
        // label the period explicitly ("All time · 22 Dec 2025 – 26 Jun 2026"),
        // removing the apparent contradiction with the Sales tab's trailing-30d view.
        // (Verified: SUM(attributed_sales) over this span == store net sales exactly,
        // i.e. the hour-share attribution partitions correctly — no double-count.)
        query(
          `SELECT MIN(shift_date)::text AS min_date, MAX(shift_date)::text AS max_date
           FROM store_pipeline.rpt_employee_productivity`
        ),
        // #15 — staffing vs sales by hour (defensive; not-yet-deployed table)
        fetchStaffingVsSales(),
        // T5 — per-day per-employee attributed sales (last 30 distinct shift dates)
        fetchDailyEmployeeSales(),
      ]);

      const employees = summaryRows.map((r) => ({
        employeeId: String(r.employee_id),
        employeeName: r.employee_name || `Employee #${r.employee_id}`,
        totalShifts: toNumber(r.total_shifts),
        totalHours: toNumber(r.total_hours),
        regularHours: toNumber(r.regular_hours),
        ot125Hours: toNumber(r.ot125_hours),
        ot150Hours: toNumber(r.ot150_hours),
        hourlyRate: toNumber(r.hourly_rate),
        totalPay: toNumber(r.total_pay),
        avgHourlyCost: toNumber(r.avg_hourly_cost),
        attributedSales: toNumber(r.attributed_sales),
        salesPerLaborShekel: toNumber(r.sales_per_labor_shekel),
        avgDailySales7d: toNumber(r.avg_daily_sales_7d),
        avgDailyHours7d: toNumber(r.avg_daily_hours_7d),
        salesRank: toNumber(r.sales_rank),
        hoursRank: toNumber(r.hours_rank),
        efficiencyRank: toNumber(r.efficiency_rank),
      }));

      const dailyTrend = dailyRows.map((r) => ({
        date: toIsoDate(r.shift_date),
        employeeId: String(r.employee_id),
        employeeName: r.employee_name || `Employee #${r.employee_id}`,
        hoursWorked: toNumber(r.hours_worked),
        shiftCount: toNumber(r.shift_count),
        salesAmount: toNumber(r.sales_amount),
        salesPerHour: toNumber(r.sales_per_hour),
      }));
      const trendDays = new Set(dailyTrend.map((d) => d.date)).size;

      const allTimeStart = toIsoDate(boundsRows?.[0]?.min_date);
      const allTimeEnd = toIsoDate(boundsRows?.[0]?.max_date);
      const allTimeLabel = allTimeStart && allTimeEnd
        ? `All time · ${formatWorkforcePeriodLabel(allTimeStart, allTimeEnd)}`
        : 'All time';

      return {
        employees,
        dailyTrend,
        dailyEmployeeSales,
        trendDays,
        staffingVsSales,
        kpis: computeKpis(employees),
        period: { start: allTimeStart, end: allTimeEnd, label: allTimeLabel, scoped: false },
      };
    }

    // ── Scoped: recompute per-employee aggregates from date-grained tables ──
    const boundsRows = await query(
      `SELECT MIN(shift_date)::text AS min_date, MAX(shift_date)::text AS max_date
       FROM store_pipeline.fct_employee_shift`
    );
    const start = dateFrom || toIsoDate(boundsRows?.[0]?.min_date);
    const end = dateTo || toIsoDate(boundsRows?.[0]?.max_date);
    const label = formatWorkforcePeriodLabel(start, end);

    if (!start || !end) {
      return { ...EMPTY, period: { start, end, label, scoped: true } };
    }

    const [shiftRows, salesRows, dailyRows, staffingVsSales, dailyEmployeeSales] = await Promise.all([
      // Hours / pay aggregated per employee over the window.
      query(
        `SELECT employee_id,
                MAX(employee_name)  AS employee_name,
                COUNT(*)            AS total_shifts,
                SUM(regular_hours)  AS regular_hours,
                SUM(ot125_hours)    AS ot125_hours,
                SUM(ot150_hours)    AS ot150_hours,
                MAX(hourly_rate)    AS hourly_rate,
                SUM(total_pay)      AS total_pay
         FROM store_pipeline.fct_employee_shift
         WHERE shift_date BETWEEN $1 AND $2
         GROUP BY employee_id`,
        [start, end]
      ),
      // Attributed sales + active days per employee over the same window.
      query(
        `SELECT employee_id,
                SUM(sales_amount)            AS attributed_sales,
                COUNT(DISTINCT shift_date)   AS active_days
         FROM store_pipeline.rpt_employee_productivity
         WHERE shift_date BETWEEN $1 AND $2
         GROUP BY employee_id`,
        [start, end]
      ),
      // Per-day detail over the window (drives the trend line).
      query(
        `SELECT shift_date::text, employee_id, employee_name,
                hours_worked, shift_count, sales_amount, sales_per_hour
         FROM store_pipeline.rpt_employee_productivity
         WHERE shift_date BETWEEN $1 AND $2
         ORDER BY shift_date ASC, employee_id ASC`,
        [start, end]
      ),
      // #15 — staffing vs sales by hour (defensive; not-yet-deployed table)
      fetchStaffingVsSales(),
      // T5 — per-day per-employee attributed sales over the scoped window
      fetchDailyEmployeeSales(),
    ]);

    if (!shiftRows.length) {
      return { ...EMPTY, dailyEmployeeSales, staffingVsSales, period: { start, end, label, scoped: true } };
    }

    const salesById = new Map(
      salesRows.map((r) => [
        String(r.employee_id),
        {
          attributedSales: toNumber(r.attributed_sales),
          activeDays: toNumber(r.active_days),
        },
      ])
    );

    let employees = shiftRows.map((r) => {
      const id = String(r.employee_id);
      const regularHours = toNumber(r.regular_hours);
      const ot125Hours = toNumber(r.ot125_hours);
      const ot150Hours = toNumber(r.ot150_hours);
      const totalHours = regularHours + ot125Hours + ot150Hours;
      const totalPay = toNumber(r.total_pay);
      const sales = salesById.get(id) || { attributedSales: 0, activeDays: 0 };
      const attributedSales = sales.attributedSales;
      const activeDays = sales.activeDays;
      return {
        employeeId: id,
        employeeName: r.employee_name || `Employee #${id}`,
        totalShifts: toNumber(r.total_shifts),
        totalHours,
        regularHours,
        ot125Hours,
        ot150Hours,
        hourlyRate: toNumber(r.hourly_rate),
        totalPay,
        avgHourlyCost: totalPay > 0 && totalHours > 0 ? totalPay / totalHours : 0,
        attributedSales,
        salesPerLaborShekel: totalPay > 0 ? attributedSales / totalPay : 0,
        avgDailySales7d: activeDays > 0 ? attributedSales / activeDays : 0,
        avgDailyHours7d: activeDays > 0 ? totalHours / activeDays : 0,
        salesRank: 0,
        hoursRank: 0,
        efficiencyRank: 0,
      };
    });

    // Recompute the three ranks in JS over the scoped set (1 = best).
    const assignRank = (key, field) => {
      [...employees]
        .sort((a, b) => b[field] - a[field])
        .forEach((e, i) => { e[key] = i + 1; });
    };
    assignRank('salesRank', 'attributedSales');
    assignRank('hoursRank', 'totalHours');
    assignRank('efficiencyRank', 'salesPerLaborShekel');

    // Match unscoped default ordering (best sales first).
    employees = employees.sort((a, b) => a.salesRank - b.salesRank);

    const dailyTrend = dailyRows.map((r) => ({
      date: toIsoDate(r.shift_date),
      employeeId: String(r.employee_id),
      employeeName: r.employee_name || `Employee #${r.employee_id}`,
      hoursWorked: toNumber(r.hours_worked),
      shiftCount: toNumber(r.shift_count),
      salesAmount: toNumber(r.sales_amount),
      salesPerHour: toNumber(r.sales_per_hour),
    }));
    const trendDays = new Set(dailyTrend.map((d) => d.date)).size;

    return {
      employees,
      dailyTrend,
      dailyEmployeeSales,
      trendDays,
      staffingVsSales,
      kpis: computeKpis(employees),
      period: { start, end, label, scoped: true },
    };
  } catch (e) {
    console.error('[dashboardData] fetchWorkforceDashboardData error:', e.message);
    return { ...EMPTY, period: { start: dateFrom, end: dateTo, label: scoped ? 'Selected range' : 'All time', scoped } };
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
export const fetchWorkforceDashboardData = unstable_cache(
  fetchWorkforceDashboardData_core,
  ['workforce-dashboard'],
  { revalidate: DASHBOARD_TTL, tags: ['dashboard'] }
);
export const fetchOverviewFilterOptions = unstable_cache(
  fetchOverviewFilterOptions_core,
  ['overview-filter-options'],
  { revalidate: FILTER_TTL, tags: ['dashboard'] }
);

// ─── Test dashboard (experimental page) ─────────────────────────────────────────
// Additive — does NOT modify any existing function. Powers /test-dash with 4 KPIs
// over a selectable time window (day | week | month) within a chosen month/year.
// Reuses the shared pool + query() helper.
const TEST_DASH_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatTestDashDate(iso) {
  // iso "YYYY-MM-DD" → "09 Jun 2026"
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d} ${TEST_DASH_MONTHS[Number(m) - 1]} ${y}`;
}

const TEST_DASH_WEEKDAYS = [
  'Sundays', 'Mondays', 'Tuesdays', 'Wednesdays',
  'Thursdays', 'Fridays', 'Saturdays',
];

// Weekday (Sun=0 … Sat=6) of a YYYY-MM-DD date, using UTC to avoid drift.
function isoWeekday(isoDate) {
  const clean = String(isoDate || '').slice(0, 10);
  return new Date(`${clean}T00:00:00Z`).getUTCDay();
}

async function fetchTestDashData_core({
  year,
  month,
  range,
  weekOfMonth,
  dayOfWeek,
  dayMode,
  date,
} = {}) {
  // Normalize inputs.
  const VALID_RANGES = ['day', 'week', 'month'];
  const safeRange = VALID_RANGES.includes(range) ? range : 'month';
  const VALID_DAY_MODES = ['weekday', 'date'];
  const safeDayMode = VALID_DAY_MODES.includes(dayMode) ? dayMode : 'weekday';

  let y = Number(year);
  let m = Number(month);
  const yearMonthSupplied =
    Number.isInteger(y) && y >= 1970 && y <= 9999 &&
    Number.isInteger(m) && m >= 1 && m <= 12;

  try {
    // ── Change 1: Option B default — when year/month not supplied, anchor to
    // the month/year of the GLOBAL MAX(sale_date) (not the calendar month).
    if (!yearMonthSupplied) {
      const globalRows = await query(
        `SELECT MAX(sale_date)::text AS ref FROM store_pipeline.rpt_daily_sales`
      );
      const globalMax = globalRows[0]?.ref ? toIsoDate(globalRows[0].ref) : null;
      if (!globalMax) {
        return {
          range: safeRange,
          year: y || null,
          month: m || null,
          weekOfMonth: null,
          dayOfWeek: null,
          dayMode: safeDayMode,
          date: null,
          weeksInMonth: 0,
          monthStart: null,
          monthEnd: null,
          refDate: null,
          periodStart: null,
          periodEnd: null,
          periodLabel: 'No data',
          kpis: { totalSales: 0, totalTickets: 0, avgBasket: 0, totalUnits: 0 },
          hourly: [],
        };
      }
      y = Number(globalMax.slice(0, 4));
      m = Number(globalMax.slice(5, 7));
    }

    // First/last day of (y, m). Day 0 of the next month = last day of this month.
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Calendar geometry (Sunday-start weeks).
    const firstWeekdayOffset = isoWeekday(monthStart);            // Sun=0 … Sat=6
    const weeksInMonth = Math.ceil((firstWeekdayOffset + daysInMonth) / 7);

    const EMPTY = {
      range: safeRange,
      year: y,
      month: m,
      weekOfMonth: Number.isInteger(Number(weekOfMonth)) ? Number(weekOfMonth) : 1,
      dayOfWeek: Number.isInteger(Number(dayOfWeek)) ? Number(dayOfWeek) : 0,
      dayMode: safeDayMode,
      date: null,
      weeksInMonth,
      monthStart,
      monthEnd,
      refDate: null,
      periodStart: null,
      periodEnd: null,
      periodLabel: 'No data',
      kpis: { totalSales: 0, totalTickets: 0, avgBasket: 0, totalUnits: 0 },
      hourly: [],
    };

    // Reference date = latest sale_date within the chosen calendar month.
    const refRows = await query(
      `SELECT MAX(sale_date)::text AS ref
         FROM store_pipeline.rpt_daily_sales
        WHERE sale_date BETWEEN $1 AND $2`,
      [monthStart, monthEnd]
    );
    const refDate = refRows[0]?.ref ? toIsoDate(refRows[0].ref) : null;
    if (!refDate) return EMPTY;

    const refDay = Number(refDate.slice(8, 10));                 // 1-based day-of-month
    // Week index (1-based) that contains refDate.
    const refWeekOfMonth = Math.ceil((firstWeekdayOffset + refDay) / 7);

    // Resolve echoed selectors (defaults derived from refDate).
    let resolvedWeekOfMonth = Number(weekOfMonth);
    if (!Number.isInteger(resolvedWeekOfMonth) ||
        resolvedWeekOfMonth < 1 || resolvedWeekOfMonth > weeksInMonth) {
      resolvedWeekOfMonth = refWeekOfMonth;
    }
    let resolvedDayOfWeek = Number(dayOfWeek);
    if (!Number.isInteger(resolvedDayOfWeek) ||
        resolvedDayOfWeek < 0 || resolvedDayOfWeek > 6) {
      resolvedDayOfWeek = isoWeekday(refDate);
    }

    // Resolve the specific date (only meaningful for range=day + dayMode=date).
    // Valid iff it parses (YYYY-MM-DD) AND falls within [monthStart, refDate];
    // otherwise fall back to refDate so the day window is never empty.
    let resolvedDate = null;
    if (safeRange === 'day' && safeDayMode === 'date') {
      const candidate = String(date || '').slice(0, 10);
      const parses =
        /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
        !Number.isNaN(new Date(`${candidate}T00:00:00Z`).getTime()) &&
        candidate === toIsoDate(`${candidate}T00:00:00Z`);
      const inRange = parses && candidate >= monthStart && candidate <= refDate;
      resolvedDate = inRange ? candidate : refDate;
    }

    let periodStart;
    let periodEnd;
    let periodLabel;
    let rows;
    let hourlyRows;

    // Hourly breakdown SELECT — the predicate is appended per-branch so it
    // exactly matches the KPI query's day-selection. rpt_sales_by_hour uses
    // `receipt_date` (same calendar date as sale_date).
    const HOURLY_SELECT = `
      SELECT sales_hour,
             COALESCE(SUM(sales_amount), 0) AS sales,
             COALESCE(SUM(ticket_count), 0) AS tickets,
             COALESCE(SUM(units_sold), 0)   AS units
        FROM store_pipeline.rpt_sales_by_hour`;

    if (safeRange === 'day' && safeDayMode === 'date') {
      // Single specific day: periodStart = periodEnd = resolvedDate.
      periodStart = resolvedDate;
      periodEnd = resolvedDate;
      [rows, hourlyRows] = await Promise.all([
        query(
          `SELECT
             COALESCE(SUM(total_sales_amount), 0) AS total_sales,
             COALESCE(SUM(ticket_count), 0)       AS total_tickets,
             COALESCE(SUM(total_units_sold), 0)   AS total_units
           FROM store_pipeline.rpt_daily_sales
           WHERE sale_date = $1`,
          [resolvedDate]
        ),
        query(
          `${HOURLY_SELECT}
           WHERE receipt_date = $1
           GROUP BY sales_hour
           ORDER BY sales_hour`,
          [resolvedDate]
        ),
      ]);
      periodLabel = formatTestDashDate(resolvedDate);
    } else if (safeRange === 'day') {
      // Aggregate ALL dates in the month whose weekday = resolvedDayOfWeek and
      // that have data (sale_date ≤ refDate). DOW done in SQL (Sun=0 … Sat=6).
      [rows, hourlyRows] = await Promise.all([
        query(
          `SELECT
             MIN(sale_date)::text                 AS period_start,
             MAX(sale_date)::text                 AS period_end,
             COALESCE(SUM(total_sales_amount), 0) AS total_sales,
             COALESCE(SUM(ticket_count), 0)       AS total_tickets,
             COALESCE(SUM(total_units_sold), 0)   AS total_units
           FROM store_pipeline.rpt_daily_sales
           WHERE sale_date BETWEEN $1 AND $2
             AND EXTRACT(DOW FROM sale_date) = $3`,
          [monthStart, refDate, resolvedDayOfWeek]
        ),
        query(
          `${HOURLY_SELECT}
           WHERE receipt_date BETWEEN $1 AND $2
             AND EXTRACT(DOW FROM receipt_date) = $3
           GROUP BY sales_hour
           ORDER BY sales_hour`,
          [monthStart, refDate, resolvedDayOfWeek]
        ),
      ]);
      const r0 = rows[0] || {};
      periodStart = r0.period_start ? toIsoDate(r0.period_start) : null;
      periodEnd = r0.period_end ? toIsoDate(r0.period_end) : null;
      periodLabel = `${TEST_DASH_WEEKDAYS[resolvedDayOfWeek]} · ${TEST_DASH_MONTHS[m - 1]} ${y}`;
    } else if (safeRange === 'week') {
      // Sun..Sat span for the selected week index, clamped to the month.
      // Day-of-month (1-based) where this week's Sunday falls:
      const weekStartDom = (resolvedWeekOfMonth - 1) * 7 - firstWeekdayOffset + 1;
      const weekEndDom = weekStartDom + 6;
      const clampedStartDom = Math.max(1, weekStartDom);
      const clampedEndDom = Math.min(daysInMonth, weekEndDom);
      periodStart = `${y}-${String(m).padStart(2, '0')}-${String(clampedStartDom).padStart(2, '0')}`;
      periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(clampedEndDom).padStart(2, '0')}`;

      [rows, hourlyRows] = await Promise.all([
        query(
          `SELECT
             COALESCE(SUM(total_sales_amount), 0) AS total_sales,
             COALESCE(SUM(ticket_count), 0)       AS total_tickets,
             COALESCE(SUM(total_units_sold), 0)   AS total_units
           FROM store_pipeline.rpt_daily_sales
           WHERE sale_date BETWEEN $1 AND $2`,
          [periodStart, periodEnd]
        ),
        query(
          `${HOURLY_SELECT}
           WHERE receipt_date BETWEEN $1 AND $2
           GROUP BY sales_hour
           ORDER BY sales_hour`,
          [periodStart, periodEnd]
        ),
      ]);
      periodLabel = `Week ${resolvedWeekOfMonth} · ${String(periodStart).slice(8, 10)}–${formatTestDashDate(periodEnd)}`;
    } else {
      // month → [monthStart, refDate]
      periodStart = monthStart;
      periodEnd = refDate;
      [rows, hourlyRows] = await Promise.all([
        query(
          `SELECT
             COALESCE(SUM(total_sales_amount), 0) AS total_sales,
             COALESCE(SUM(ticket_count), 0)       AS total_tickets,
             COALESCE(SUM(total_units_sold), 0)   AS total_units
           FROM store_pipeline.rpt_daily_sales
           WHERE sale_date BETWEEN $1 AND $2`,
          [periodStart, periodEnd]
        ),
        query(
          `${HOURLY_SELECT}
           WHERE receipt_date BETWEEN $1 AND $2
           GROUP BY sales_hour
           ORDER BY sales_hour`,
          [periodStart, periodEnd]
        ),
      ]);
      periodLabel = `${String(periodStart).slice(8, 10)}–${formatTestDashDate(periodEnd)}`;
    }

    const r = rows[0] || {};
    const totalSales = toNumber(r.total_sales);
    const totalTickets = toNumber(r.total_tickets);
    const totalUnits = toNumber(r.total_units);

    const hourly = (hourlyRows || []).map((h) => ({
      hour: Number.parseInt(h.sales_hour, 10),
      sales: toNumber(h.sales),
      tickets: toNumber(h.tickets),
      units: toNumber(h.units),
    }));

    return {
      range: safeRange,
      year: y,
      month: m,
      weekOfMonth: resolvedWeekOfMonth,
      dayOfWeek: resolvedDayOfWeek,
      dayMode: safeDayMode,
      date: resolvedDate,
      weeksInMonth,
      monthStart,
      monthEnd,
      refDate,
      periodStart,
      periodEnd,
      periodLabel,
      kpis: {
        totalSales,
        totalTickets,
        avgBasket: totalTickets > 0 ? totalSales / totalTickets : 0,
        totalUnits,
      },
      hourly,
    };
  } catch (e) {
    console.error('[dashboardData] fetchTestDashData error:', e.message);
    return {
      range: safeRange,
      year: Number.isInteger(y) ? y : null,
      month: Number.isInteger(m) ? m : null,
      weekOfMonth: null,
      dayOfWeek: null,
      dayMode: safeDayMode,
      date: null,
      weeksInMonth: 0,
      monthStart: null,
      monthEnd: null,
      refDate: null,
      periodStart: null,
      periodEnd: null,
      periodLabel: 'No data',
      kpis: { totalSales: 0, totalTickets: 0, avgBasket: 0, totalUnits: 0 },
      hourly: [],
    };
  }
}

export const fetchTestDashData = unstable_cache(
  fetchTestDashData_core,
  ['test-dash'],
  { revalidate: DASHBOARD_TTL, tags: ['dashboard'] }
);
