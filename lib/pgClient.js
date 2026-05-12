// lib/pgClient.js
// Direct PostgreSQL connection via pg Pool — mirrors the pattern from the previous project.
// Used for schemas/tables not exposed through the Supabase public API
// (e.g. shlomy_store.payments_complete).

import { Pool } from 'pg';

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'store_pipeline';
const table = process.env.NEXT_DB_TABLE || 'stg_fact_sales_p';

const reportingTables = {
  dailySales: 'rpt_daily_sales',
  executiveSummaryDaily: 'rpt_executive_summary_daily',
  inventoryRisk: 'rpt_inventory_risk',
  productPerformance30d: 'rpt_product_performance_30d',
};

const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function quoteIdentifier(value, name) {
  if (!identifierRegex.test(value)) {
    throw new Error(`Invalid SQL identifier for ${name}`);
  }
  return `"${value}"`;
}

export const qualifiedPaymentsTable = `${quoteIdentifier(schema, 'PAYMENTS_SCHEMA')}.${quoteIdentifier(table, 'PAYMENTS_TABLE')}`;
const qualifiedDailySalesTable = `${quoteIdentifier(schema, 'REPORTING_SCHEMA')}.${quoteIdentifier(reportingTables.dailySales, 'RPT_DAILY_SALES')}`;
const qualifiedExecutiveSummaryDailyTable = `${quoteIdentifier(schema, 'REPORTING_SCHEMA')}.${quoteIdentifier(reportingTables.executiveSummaryDaily, 'RPT_EXECUTIVE_SUMMARY_DAILY')}`;
const qualifiedInventoryRiskTable = `${quoteIdentifier(schema, 'REPORTING_SCHEMA')}.${quoteIdentifier(reportingTables.inventoryRisk, 'RPT_INVENTORY_RISK')}`;
const qualifiedProductPerformance30dTable = `${quoteIdentifier(schema, 'REPORTING_SCHEMA')}.${quoteIdentifier(reportingTables.productPerformance30d, 'RPT_PRODUCT_PERFORMANCE_30D')}`;


const pool = new Pool({
  connectionString: process.env.NEXT_DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: false },
});

export async function fetchPayments() {
  if (!process.env.NEXT_DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const query = `SELECT * FROM ${qualifiedPaymentsTable} ORDER BY receiptdatetime LIMIT 50`;
  const { rows } = await pool.query(query);
  return rows;
}

export async function fetchPaymentKpis() {
  if (!process.env.NEXT_DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  // DISTINCT ON (document_id) deduplicates line-items so each receipt is counted once.
  // avg_daily_revenue divides total revenue by the number of distinct calendar days.
  const query = `
    WITH unique_docs AS (
      SELECT DISTINCT ON (document_id)
        document_id,
        receiptdate,
        receipttotal_incvat,
        iscredit
      FROM ${qualifiedPaymentsTable}
      ORDER BY document_id
    ),
    daily AS (
      SELECT COUNT(DISTINCT receiptdate) AS day_count,
             SUM(receipttotal_incvat::numeric) AS total_rev
      FROM unique_docs
    )
    SELECT
      COUNT(*)                                                             AS total_transactions,
      ROUND((SELECT total_rev FROM daily), 2)                             AS total_revenue,
      ROUND(AVG(receipttotal_incvat::numeric), 2)                        AS avg_basket_size,
      ROUND(
        100.0 * SUM(CASE WHEN iscredit::int = 1 THEN 1 ELSE 0 END)::numeric
        / NULLIF(COUNT(*), 0), 1
      )                                                                    AS credit_rate,
      ROUND(
        (SELECT total_rev FROM daily) / NULLIF((SELECT day_count FROM daily), 0),
        2
      )                                                                    AS avg_daily_revenue
    FROM unique_docs
  `;
  const { rows } = await pool.query(query);
  return rows[0];
}

export async function fetchPaymentKpiComparison({
  currentStart,
  currentEnd,
  previousStart,
  previousEnd,
}) {
  if (!process.env.NEXT_DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const query = `
    WITH unique_docs AS (
      SELECT DISTINCT ON (document_id)
        document_id,
        receiptdate,
        receipttotal_incvat,
        iscredit
      FROM ${qualifiedPaymentsTable}
      ORDER BY document_id
    ),
    scoped_docs AS (
      SELECT
        CASE
          WHEN receiptdate >= $1::date AND receiptdate < $2::date THEN 'current'
          WHEN receiptdate >= $3::date AND receiptdate < $4::date THEN 'previous'
          ELSE NULL
        END AS period,
        receiptdate,
        receipttotal_incvat::numeric AS receipttotal_incvat,
        COALESCE(iscredit::int, 0) AS iscredit
      FROM unique_docs
      WHERE receiptdate >= $3::date AND receiptdate < $2::date
    )
    SELECT
      period,
      COUNT(*) AS total_transactions,
      ROUND(SUM(receipttotal_incvat), 2) AS total_revenue,
      ROUND(AVG(receipttotal_incvat), 2) AS avg_basket_size,
      ROUND(
        100.0 * SUM(CASE WHEN iscredit = 1 THEN 1 ELSE 0 END)::numeric
        / NULLIF(COUNT(*), 0),
        1
      ) AS credit_rate,
      ROUND(
        SUM(receipttotal_incvat) / NULLIF(COUNT(DISTINCT receiptdate), 0),
        2
      ) AS avg_daily_revenue,
      COUNT(DISTINCT receiptdate) AS trading_days
    FROM scoped_docs
    WHERE period IS NOT NULL
    GROUP BY period
  `;

  const { rows } = await pool.query(query, [
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  ]);

  const defaultSnapshot = {
    total_transactions: null,
    total_revenue: null,
    avg_basket_size: null,
    credit_rate: null,
    avg_daily_revenue: null,
    trading_days: null,
  };

  const snapshots = rows.reduce(
    (accumulator, row) => {
      accumulator[row.period] = {
        total_transactions:
          row.total_transactions == null ? null : Number(row.total_transactions),
        total_revenue: row.total_revenue == null ? null : Number(row.total_revenue),
        avg_basket_size:
          row.avg_basket_size == null ? null : Number(row.avg_basket_size),
        credit_rate: row.credit_rate == null ? null : Number(row.credit_rate),
        avg_daily_revenue:
          row.avg_daily_revenue == null ? null : Number(row.avg_daily_revenue),
        trading_days: row.trading_days == null ? null : Number(row.trading_days),
      };
      return accumulator;
    },
    {
      current: { ...defaultSnapshot },
      previous: { ...defaultSnapshot },
    }
  );

  return snapshots;
}

export async function fetchDailySales() {
  if (!process.env.NEXT_DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  // Deduplicate by document_id first, then group by date to get true daily totals.
  const query = `
    WITH unique_docs AS (
      SELECT DISTINCT ON (document_id)
        document_id,
        receiptdate,
        receipttotal_incvat
      FROM ${qualifiedPaymentsTable}
      ORDER BY document_id
    )
    SELECT
      receiptdate                                    AS date,
      ROUND(SUM(receipttotal_incvat::numeric), 2)   AS total
    FROM unique_docs
    GROUP BY receiptdate
    ORDER BY receiptdate
  `;
  const { rows } = await pool.query(query);
  // Format date as DD/MM for chart X-axis
  return rows.map((r) => ({
    date: new Date(r.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
    total: Number(r.total),
  }));
}

function toNumber(value, fallback = 0) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeStatusLabel(value) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'OUT_OF_STOCK') return 'Out of stock';
  if (status === 'STOCKOUT_RISK') return 'Stockout risk';
  if (status === 'OVERSTOCK') return 'Overstock';
  if (status === 'DEAD_STOCK') return 'Dead stock';
  return status
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export async function fetchOverviewDashboardData() {
  if (!process.env.NEXT_DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const emptyState = {
    freshness: null,
    latestSaleDate: null,
    currentPeriod: { start: null, end: null, days: 30 },
    previousPeriod: { start: null, end: null, days: 30 },
    kpis: {
      totalSales: 0,
      salesDeltaPct: null,
      totalTickets: 0,
      avgTicketAmount: 0,
      totalUnitsSold: 0,
      outOfStockCount: 0,
      stockoutRiskCount: 0,
      deadStockCount: 0,
    },
    dailySalesTrend: [],
    ticketTrend: [],
    topProducts: [],
    inventoryDistribution: [],
    recentDailyPerformance: [],
  };

  const boundsQuery = `
    WITH latest_sales AS (
      SELECT MAX(sale_date) AS latest_sale_date
      FROM ${qualifiedDailySalesTable}
    )
    SELECT
      latest_sale_date,
      (latest_sale_date - INTERVAL '29 day')::date AS current_start,
      latest_sale_date::date AS current_end,
      (latest_sale_date - INTERVAL '59 day')::date AS previous_start,
      (latest_sale_date - INTERVAL '30 day')::date AS previous_end,
      (
        SELECT MAX(dbt_loaded_at)
        FROM ${qualifiedExecutiveSummaryDailyTable}
      ) AS freshness
    FROM latest_sales
  `;

  const { rows: boundsRows } = await pool.query(boundsQuery);
  const bounds = boundsRows[0];

  if (!bounds?.latest_sale_date) {
    return emptyState;
  }

  const periods = {
    currentStart: bounds.current_start,
    currentEnd: bounds.current_end,
    previousStart: bounds.previous_start,
    previousEnd: bounds.previous_end,
  };

  const metricsQuery = `
    WITH periodized AS (
      SELECT
        CASE
          WHEN sale_date BETWEEN $1::date AND $2::date THEN 'current'
          WHEN sale_date BETWEEN $3::date AND $4::date THEN 'previous'
          ELSE NULL
        END AS period,
        sale_date,
        total_sales_amount,
        total_units_sold,
        ticket_count
      FROM ${qualifiedDailySalesTable}
      WHERE sale_date BETWEEN $3::date AND $2::date
    )
    SELECT
      period,
      ROUND(SUM(total_sales_amount), 2) AS total_sales,
      ROUND(SUM(total_units_sold), 2) AS total_units_sold,
      SUM(ticket_count) AS total_tickets,
      ROUND(SUM(total_sales_amount) / NULLIF(SUM(ticket_count), 0), 2) AS avg_ticket_amount
    FROM periodized
    WHERE period IS NOT NULL
    GROUP BY period
  `;

  const inventorySnapshotQuery = `
    WITH latest_snapshot AS (
      SELECT MAX(snapshot_date) AS snapshot_date
      FROM ${qualifiedInventoryRiskTable}
    )
    SELECT
      stock_status,
      COUNT(*) AS item_count,
      (SELECT snapshot_date FROM latest_snapshot) AS snapshot_date
    FROM ${qualifiedInventoryRiskTable}
    WHERE snapshot_date = (SELECT snapshot_date FROM latest_snapshot)
    GROUP BY stock_status
    ORDER BY item_count DESC
  `;

  const topProductsQuery = `
    SELECT
      item_id,
      item_name,
      product_category_name,
      sales_amount_30d,
      units_sold_30d,
      stock_status,
      sales_rank_30d
    FROM ${qualifiedProductPerformance30dTable}
    ORDER BY sales_amount_30d DESC NULLS LAST
    LIMIT 10
  `;

  const recentDailyPerformanceQuery = `
    SELECT
      sale_date,
      total_sales_amount,
      total_units_sold,
      ticket_count,
      avg_ticket_amount
    FROM ${qualifiedDailySalesTable}
    ORDER BY sale_date DESC
    LIMIT 14
  `;

  const currentTrendQuery = `
    SELECT
      sale_date,
      total_sales_amount,
      ticket_count
    FROM ${qualifiedDailySalesTable}
    WHERE sale_date BETWEEN $1::date AND $2::date
    ORDER BY sale_date
  `;

  const [
    metricsResult,
    inventoryResult,
    topProductsResult,
    recentDailyResult,
    trendResult,
  ] = await Promise.allSettled([
    pool.query(metricsQuery, [
      periods.currentStart,
      periods.currentEnd,
      periods.previousStart,
      periods.previousEnd,
    ]),
    pool.query(inventorySnapshotQuery),
    pool.query(topProductsQuery),
    pool.query(recentDailyPerformanceQuery),
    pool.query(currentTrendQuery, [periods.currentStart, periods.currentEnd]),
  ]);

  const metricsRows = metricsResult.status === 'fulfilled' ? metricsResult.value.rows : [];
  const inventoryRows = inventoryResult.status === 'fulfilled' ? inventoryResult.value.rows : [];
  const topProductRows = topProductsResult.status === 'fulfilled' ? topProductsResult.value.rows : [];
  const recentDailyRows = recentDailyResult.status === 'fulfilled' ? recentDailyResult.value.rows : [];
  const trendRows = trendResult.status === 'fulfilled' ? trendResult.value.rows : [];

  const currentMetrics = metricsRows.find((row) => row.period === 'current') || null;
  const previousMetrics = metricsRows.find((row) => row.period === 'previous') || null;
  const currentSales = toNumber(currentMetrics?.total_sales);
  const previousSales = toNumber(previousMetrics?.total_sales);
  const salesDeltaPct =
    previousSales > 0 ? ((currentSales - previousSales) / previousSales) * 100 : null;

  const inventoryDistribution = inventoryRows.map((row) => ({
    key: String(row.stock_status || 'UNKNOWN').toUpperCase(),
    label: normalizeStatusLabel(row.stock_status),
    value: toNumber(row.item_count),
    snapshotDate: toIsoDate(row.snapshot_date),
  }));

  const inventoryCounts = inventoryDistribution.reduce(
    (accumulator, row) => {
      accumulator[row.key] = row.value;
      return accumulator;
    },
    {}
  );

  return {
    freshness: toIsoDate(bounds.freshness),
    latestSaleDate: toIsoDate(bounds.latest_sale_date),
    currentPeriod: {
      start: toIsoDate(bounds.current_start),
      end: toIsoDate(bounds.current_end),
      days: 30,
    },
    previousPeriod: {
      start: toIsoDate(bounds.previous_start),
      end: toIsoDate(bounds.previous_end),
      days: 30,
    },
    kpis: {
      totalSales: currentSales,
      salesDeltaPct,
      totalTickets: toNumber(currentMetrics?.total_tickets),
      avgTicketAmount: toNumber(currentMetrics?.avg_ticket_amount),
      totalUnitsSold: toNumber(currentMetrics?.total_units_sold),
      outOfStockCount: toNumber(inventoryCounts.OUT_OF_STOCK),
      stockoutRiskCount: toNumber(inventoryCounts.STOCKOUT_RISK),
      deadStockCount: toNumber(inventoryCounts.DEAD_STOCK),
    },
    dailySalesTrend: trendRows.map((row) => ({
      date: toIsoDate(row.sale_date),
      sales: toNumber(row.total_sales_amount),
    })),
    ticketTrend: trendRows.map((row) => ({
      date: toIsoDate(row.sale_date),
      tickets: toNumber(row.ticket_count),
    })),
    topProducts: topProductRows.map((row) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      categoryName: row.product_category_name,
      salesAmount30d: toNumber(row.sales_amount_30d),
      unitsSold30d: toNumber(row.units_sold_30d),
      stockStatus: normalizeStatusLabel(row.stock_status),
      salesRank30d: toNumber(row.sales_rank_30d, null),
    })),
    inventoryDistribution,
    recentDailyPerformance: recentDailyRows.map((row) => ({
      saleDate: toIsoDate(row.sale_date),
      totalSalesAmount: toNumber(row.total_sales_amount),
      totalUnitsSold: toNumber(row.total_units_sold),
      ticketCount: toNumber(row.ticket_count),
      avgTicketAmount: toNumber(row.avg_ticket_amount),
    })),
  };
}