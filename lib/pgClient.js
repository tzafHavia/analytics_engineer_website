// lib/pgClient.js
// Direct PostgreSQL connection via pg Pool — mirrors the pattern from the previous project.
// Used for schemas/tables not exposed through the Supabase public API
// (e.g. shlomy_store.payments_complete).

import { Pool } from 'pg';

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'store_pipeline';
const table = process.env.NEXT_DB_TABLE || 'stg_fact_sales_p';

const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function quoteIdentifier(value, name) {
  if (!identifierRegex.test(value)) {
    throw new Error(`Invalid SQL identifier for ${name}`);
  }
  return `"${value}"`;
}

export const qualifiedPaymentsTable = `${quoteIdentifier(schema, 'PAYMENTS_SCHEMA')}.${quoteIdentifier(table, 'PAYMENTS_TABLE')}`;


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