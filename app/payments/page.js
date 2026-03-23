'use client';
import { useState, useEffect, useCallback } from 'react';
import PaymentsTable from '@/components/PaymentsTable';
import KpiCard from '@/components/KpiCard';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchPayments = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments?limit=${LIMIT}&page=${p}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || 'Failed to load payments');
        setPayments([]);
      } else {
        setPayments(json.data || []);
        setMeta(json.meta || null);
      }
    } catch (e) {
      setError('Network error – could not fetch payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments(page);
  }, [page, fetchPayments]);

  // Compute quick KPIs from current page data
  const totalAmount = payments.reduce((sum, p) => {
    const v = Number(p.amount ?? p.total ?? p.price ?? p.sum ?? 0);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <div className="page-payments">
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-accent">Payments</span> Dashboard
        </h1>
        <p className="page-desc">
          Live data from <code>shlomy_store.payments_complete</code>
          {meta && ` — ${meta.total?.toLocaleString()} total records`}
        </p>
      </div>

      {/* KPIs from current page */}
      {!error && (
        <div className="kpi-section">
          <KpiCard
            icon="📄"
            label="Records (this page)"
            value={payments.length}
            sub={`Page ${page} of ${meta?.pages ?? '—'}`}
            color="purple"
          />
          <KpiCard
            icon="💰"
            label="Page Total"
            value={`₪${totalAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`}
            sub="Sum of amounts"
            color="cyan"
          />
          <KpiCard
            icon="🗄️"
            label="Total Records"
            value={meta?.total?.toLocaleString() ?? 'Loading...'}
            sub="In database"
            color="green"
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="alert-error">
          <span>⚠️</span>
          <div>
            <strong>Could not load payments data</strong>
            <p>{error}</p>
            <button className="btn-primary mt-3" onClick={() => fetchPayments(page)}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <PaymentsTable payments={payments} loading={loading} />

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="pagination">
          <button
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span className="pagination-info">
            Page {page} / {meta.pages}
          </span>
          <button
            className="btn-ghost"
            disabled={page >= meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
