'use client';

import { useMemo, useState } from 'react';

const columns = [
  { key: 'saleDate', label: 'Sale date', type: 'date' },
  { key: 'totalSalesAmount', label: 'Total sales', type: 'currency' },
  { key: 'totalUnitsSold', label: 'Units sold', type: 'number' },
  { key: 'ticketCount', label: 'Tickets', type: 'number' },
  { key: 'avgTicketAmount', label: 'Avg. ticket', type: 'currency' },
];

function formatValue(value, type) {
  if (value == null) return '—';
  if (type === 'date') {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  if (type === 'currency') {
    return `₪${Number(value).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
  }
  return Number(value).toLocaleString('he-IL');
}

function compareValues(left, right, type) {
  if (type === 'date') return new Date(left).getTime() - new Date(right).getTime();
  return Number(left) - Number(right);
}

export default function OverviewDailyPerformanceTable({ rows = [] }) {
  const [sortKey, setSortKey] = useState('saleDate');
  const [direction, setDirection] = useState('desc');

  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey) || columns[0];
    const nextRows = [...rows].sort((left, right) => {
      const result = compareValues(left[sortKey], right[sortKey], column.type);
      return direction === 'asc' ? result : -result;
    });
    return nextRows;
  }, [direction, rows, sortKey]);

  function handleSort(nextKey) {
    if (nextKey === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setDirection(nextKey === 'saleDate' ? 'desc' : 'desc');
  }

  if (!rows.length) {
    return (
      <div className="table-empty od-empty-card">
        <span>∅</span>
        <p>No recent daily performance rows returned.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => {
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
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.saleDate} className="table-row">
              {columns.map((column) => (
                <td key={column.key}>{formatValue(row[column.key], column.type)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}