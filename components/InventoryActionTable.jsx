import ShowMoreTable from '@/components/ShowMoreTable';

function formatDoc(days) {
  if (days == null) return '—';
  return `${Number(days).toFixed(1)}d`;
}

function StatusBadge({ status, velocityBand }) {
  const s = String(status || '').toLowerCase();
  const v = String(velocityBand || '').toLowerCase();
  if (s === 'out_of_stock')   return <span className="inv-badge inv-badge-red">Out of stock</span>;
  if (s === 'stockout_risk')  return <span className="inv-badge inv-badge-amber">Stockout risk</span>;
  if (s === 'overstock')      return <span className="inv-badge inv-badge-green">Overstock</span>;
  if (s === 'dead_stock')     return <span className="inv-badge inv-badge-gray">Dead stock</span>;
  if (v === 'no_recent_sales') return <span className="inv-badge inv-badge-gray">No recent sales</span>;
  if (s === 'healthy')        return <span className="inv-badge inv-badge-blue">Healthy</span>;
  return <span className="inv-badge inv-badge-blue">{status || velocityBand || '—'}</span>;
}

function ActionRows({ rows }) {
  if (!rows.length) {
    return (
      <div className="table-empty" style={{ padding: '2rem' }}>
        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>✓</span>
        <p>No items in this category.</p>
      </div>
    );
  }
  return (
    <div className="table-wrapper" style={{ marginTop: '1rem' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Status</th>
            <th>On hand</th>
            <th>Days cover</th>
            <th>Recommended action</th>
          </tr>
        </thead>
        <ShowMoreTable initial={12} label="items">
          {rows.map((row, i) => (
            <tr key={`${row.itemId}-${i}`} className="table-row">
              <td>{row.itemName}</td>
              <td>{row.categoryName}</td>
              <td>
                <StatusBadge status={row.stockStatus} velocityBand={row.velocityBand} />
              </td>
              <td>{row.inventoryQty}</td>
              <td>{formatDoc(row.daysOfCover30d)}</td>
              <td className="inv-action-text">{row.recommendedAction || '—'}</td>
            </tr>
          ))}
        </ShowMoreTable>
      </table>
    </div>
  );
}

export default function InventoryActionTable({ reorderItems = [], overstockItems = [], deadStockItems = [] }) {
  return (
    <div className="inv-action-sections">
      <div className="od-panel inv-action-panel inv-action-panel-red">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Reorder now · {reorderItems.length} items</p>
            <h3>Items requiring immediate reorder</h3>
          </div>
        </div>
        <p className="od-panel-copy">
          Products flagged for restock — out of stock or critically low on coverage.
        </p>
        <ActionRows rows={reorderItems} />
      </div>

      <div className="od-panel inv-action-panel inv-action-panel-green">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Overstock review · {overstockItems.length} items</p>
            <h3>Overstocked items to review</h3>
          </div>
        </div>
        <p className="od-panel-copy">
          Products with excess stock relative to the current 30-day sales velocity.
        </p>
        <ActionRows rows={overstockItems} />
      </div>

      <div className="od-panel inv-action-panel inv-action-panel-gray">
        <div className="od-panel-head">
          <div>
            <p className="od-panel-kicker">Dead stock · {deadStockItems.length} items</p>
            <h3>Dead stock list</h3>
          </div>
        </div>
        <p className="od-panel-copy">
          Products with near-zero movement over the past 30 days. Consider markdown or removal.
        </p>
        <ActionRows rows={deadStockItems} />
      </div>
    </div>
  );
}
