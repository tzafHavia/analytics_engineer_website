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
});

export async function fetchPayments() {
  if (!process.env.NEXT_DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const query = `SELECT * FROM ${qualifiedPaymentsTable} ORDER BY receiptdatetime LIMIT 50`;
  const { rows } = await pool.query(query);
  return rows;
}
