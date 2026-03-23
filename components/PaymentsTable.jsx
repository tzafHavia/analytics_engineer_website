'use client';

const STATUS_COLORS = {
  completed: 'status-completed',
  pending: 'status-pending',
  failed: 'status-failed',
};

function formatCurrency(v) {
  if (v == null) return '—';
  return `₪${Number(v).toLocaleString('he-IL', { minimumFractionDigits: 2 })}`;
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function PaymentsTable({ payments = [], loading = false }) {
  if (loading) {
    return (
      <div className="table-loading">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    );
  }

  if (!payments.length) {
    return (
      <div className="table-empty">
        <span>🔍</span>
        <p>No payment records found</p>
      </div>
    );
  }

  // Derive columns dynamically from first row
  const columns = Object.keys(payments[0]);

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((row, i) => (
            <tr key={i} className="table-row">
              {columns.map((col) => {
                const val = row[col];
                const isStatus = col.toLowerCase().includes('status');
                const isAmount =
                  col.toLowerCase().includes('amount') ||
                  col.toLowerCase().includes('total') ||
                  col.toLowerCase().includes('price');
                const isDate =
                  col.toLowerCase().includes('date') ||
                  col.toLowerCase().includes('time') ||
                  col.toLowerCase().includes('created');

                return (
                  <td key={col}>
                    {isStatus ? (
                      <span
                        className={`status-badge ${
                          STATUS_COLORS[String(val).toLowerCase()] || 'status-default'
                        }`}
                      >
                        {val}
                      </span>
                    ) : isAmount ? (
                      formatCurrency(val)
                    ) : isDate ? (
                      formatDate(val)
                    ) : (
                      String(val ?? '—')
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
