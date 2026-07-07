'use client';

import { useMemo, useState } from 'react';
import ShowMoreTable from '@/components/ShowMoreTable';

const AT_RISK_STATUSES = new Set(['STOCKOUT_RISK', 'OUT_OF_STOCK']);

const STATUS_LABELS = {
  OUT_OF_STOCK: 'Out of stock',
  STOCKOUT_RISK: 'Stockout risk',
  HEALTHY: 'Healthy',
  OVERSTOCK: 'Overstock',
};

function statusLabel(status) {
  const s = String(status || '').toUpperCase();
  if (STATUS_LABELS[s]) return STATUS_LABELS[s];
  // Fallback: Title-case the raw enum (e.g. DEAD_STOCK → "Dead stock").
  if (!s) return '—';
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

function StatusBadge({ status }) {
  const s = String(status || '').toUpperCase();
  if (s === 'OUT_OF_STOCK')  return <span className="inv-badge inv-badge-red">Out of stock</span>;
  if (s === 'STOCKOUT_RISK') return <span className="inv-badge inv-badge-amber">Stockout risk</span>;
  if (s === 'HEALTHY')       return <span className="inv-badge inv-badge-green">Healthy</span>;
  if (s === 'OVERSTOCK')     return <span className="inv-badge inv-badge-blue">Overstock</span>;
  return <span className="inv-badge inv-badge-gray">{statusLabel(status)}</span>;
}

/** Severity color for the at-risk bar — fuller/redder = worse. */
function barColor(pct) {
  if (pct >= 66) return 'var(--red)';
  if (pct >= 33) return 'var(--yellow)';
  return 'var(--text-muted)';
}

function AtRiskBar({ pct }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <span className="wo-riskbar-cell">
      <span className="wo-riskbar-track" aria-hidden="true">
        <span
          className="wo-riskbar-fill"
          style={{ width: `${value}%`, backgroundColor: barColor(value) }}
        />
      </span>
      <span className="wo-riskbar-value">{value.toFixed(0)}%</span>
    </span>
  );
}

const COLUMNS = [
  { key: 'itemName',            label: 'Item',          type: 'string' },
  { key: 'categoryName',        label: 'Category',      type: 'string' },
  { key: 'atRiskPct',           label: 'At-risk %',     type: 'number' },
  { key: 'atRiskDays',          label: 'At-risk days',  type: 'number' },
  { key: 'longestAtRiskStreak', label: 'Longest streak',type: 'number' },
  { key: 'currentStockStatus',  label: 'Status',        type: 'string' },
];

function compareValues(left, right, type) {
  if (type === 'string') {
    return String(left ?? '').localeCompare(String(right ?? ''));
  }
  return (Number(left) || 0) - (Number(right) || 0);
}

/** Placeholder rows (unmapped/uncategorized) sort after real items. */
function isPlaceholderRow(row) {
  return row?.itemName === '(unmapped item)' || row?.categoryName === '(uncategorized)';
}

export default function WorstOffendersTable({ items = [] }) {
  const [riskOnly, setRiskOnly] = useState(true);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sortKey, setSortKey] = useState('atRiskPct');
  const [direction, setDirection] = useState('desc');

  const categoryOptions = useMemo(() => {
    const set = new Set();
    items.forEach((it) => { if (it.categoryName) set.add(it.categoryName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const statusOptions = useMemo(() => {
    const set = new Set();
    items.forEach((it) => { if (it.currentStockStatus) set.add(String(it.currentStockStatus).toUpperCase()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (riskOnly && !AT_RISK_STATUSES.has(String(it.currentStockStatus).toUpperCase())) return false;
      if (category && it.categoryName !== category) return false;
      if (status && String(it.currentStockStatus).toUpperCase() !== status) return false;
      return true;
    });
  }, [items, riskOnly, category, status]);

  const sorted = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[2];
    const next = [...filtered].sort((left, right) => {
      const result = compareValues(left[sortKey], right[sortKey], column.type);
      return direction === 'asc' ? result : -result;
    });
    // Stable pass: keep real items first, group placeholder rows at the bottom.
    next.sort((left, right) => (isPlaceholderRow(left) ? 1 : 0) - (isPlaceholderRow(right) ? 1 : 0));
    return next;
  }, [filtered, sortKey, direction]);

  function handleSort(nextKey) {
    if (nextKey === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    // Strings default A→Z (asc); numbers default worst-first (desc).
    const col = COLUMNS.find((c) => c.key === nextKey);
    setDirection(col && col.type === 'string' ? 'asc' : 'desc');
  }

  const hasItems = items.length > 0;
  const hasRows = sorted.length > 0;

  return (
    <div className="od-panel">
      <div className="od-tab-filter-bar">
        <label className="od-filter-field od-filter-field--inline wo-toggle">
          <input
            type="checkbox"
            checked={riskOnly}
            onChange={(e) => setRiskOnly(e.target.checked)}
          />
          <span>Currently at risk only</span>
        </label>

        <label className="od-filter-field od-filter-field--inline">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="od-filter-field od-filter-field--inline">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </label>

        <span className="od-faint-note wo-count">
          {hasRows
            ? `${sorted.length.toLocaleString('he-IL')} of ${items.length.toLocaleString('he-IL')} items`
            : `0 of ${items.length.toLocaleString('he-IL')} items`}
        </span>
      </div>

      {!hasItems ? (
        <div className="table-empty od-empty-card">
          <span>✓</span>
          <p>No chronic stockout offenders detected.</p>
        </div>
      ) : !hasRows ? (
        <div className="table-empty od-empty-card">
          <span>∅</span>
          <p>No items match the current filters.</p>
        </div>
      ) : (
        <div className="table-wrapper" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = column.key === sortKey;
                  return (
                    <th key={column.key}>
                      <button
                        type="button"
                        className={`od-sort-button ${active ? 'od-sort-button-active' : ''}`}
                        onClick={() => handleSort(column.key)}
                      >
                        <span>{column.label}</span>
                        <span>{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <ShowMoreTable initial={12} label="items">
              {sorted.map((row, i) => (
                <tr key={`${row.itemId}-${i}`} className="table-row">
                  <td dir="rtl">{row.itemName}</td>
                  <td>{row.categoryName || '—'}</td>
                  <td><AtRiskBar pct={row.atRiskPct} /></td>
                  <td>{Number(row.atRiskDays ?? 0).toLocaleString('he-IL')}</td>
                  <td>{Number(row.longestAtRiskStreak ?? 0).toLocaleString('he-IL')}</td>
                  <td><StatusBadge status={row.currentStockStatus} /></td>
                </tr>
              ))}
            </ShowMoreTable>
          </table>
        </div>
      )}
    </div>
  );
}
