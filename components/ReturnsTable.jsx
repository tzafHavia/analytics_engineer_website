'use client';

import { useMemo, useState } from 'react';
import ShowMoreTable from '@/components/ShowMoreTable';

function formatCurrency(value) {
  return `₪${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

/**
 * Client-side returns table with a compact category filter.
 *
 * Receives the full `returnsByProduct` rows (each with a Hebrew `categoryName`),
 * shows a category <select> above the table, filters client-side and renders the
 * top 20 by return amount for the chosen category ("All categories" = global top 20).
 */
export default function ReturnsTable({ rows = [], periodLabel }) {
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => {
      if (row.categoryName) set.add(row.categoryName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = selectedCategory
      ? rows.filter((row) => row.categoryName === selectedCategory)
      : rows;
    return [...filtered]
      .sort((a, b) => Number(b.returnAmount || 0) - Number(a.returnAmount || 0))
      .slice(0, 20);
  }, [rows, selectedCategory]);

  return (
    <div className="od-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Returns · {periodLabel}</p>
          <h3>Top returning products</h3>
        </div>
        {categories.length > 0 && (
          <label className="od-filter-field od-filter-field--inline od-chart-filter">
            <span>Category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="od-panel-copy">
        Products ranked by return amount within the selected period.
      </p>
      {visibleRows.length === 0 ? (
        <div className="table-empty od-empty-card">
          <span>✓</span>
          <p>No returns recorded for this period.</p>
        </div>
      ) : (
        <div className="table-wrapper" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Return qty</th>
                <th>Return amount</th>
                <th>Tickets</th>
              </tr>
            </thead>
            <ShowMoreTable initial={12} label="products">
              {visibleRows.map((row, i) => (
                <tr key={`${row.itemId}-${i}`} className="table-row">
                  <td>{row.itemName}</td>
                  <td>{row.categoryName}</td>
                  <td>{Number(row.returnQty).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                  <td>{formatCurrency(row.returnAmount)}</td>
                  <td>{Number(row.returnTickets).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </ShowMoreTable>
          </table>
        </div>
      )}
    </div>
  );
}
