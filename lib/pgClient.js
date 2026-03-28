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