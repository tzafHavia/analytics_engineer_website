'use client';

import { useState } from 'react';

/**
 * Caps a long list of already-rendered table rows to the first `initial`
 * and reveals the rest behind a "Show all N" / "Show less" toggle.
 *
 * Usage (inside a SERVER component) — pass server-rendered <tr> elements:
 *   <table className="data-table">
 *     <thead>…</thead>
 *     <ShowMoreTable initial={12} label="categories">
 *       {rows.map(r => <tr key={…}>…</tr>)}
 *     </ShowMoreTable>
 *   </table>
 *
 * Renders a <tbody>; the toggle lives in a full-width footer row so the
 * table layout/columns are never disturbed.
 */
export default function ShowMoreTable({ children, initial = 12, label = 'rows' }) {
  const [expanded, setExpanded] = useState(false);

  const rows = Array.isArray(children) ? children.filter(Boolean) : [children].filter(Boolean);
  const total = rows.length;
  const needsToggle = total > initial;
  const visible = expanded || !needsToggle ? rows : rows.slice(0, initial);

  // colSpan large enough to span any table here; 1000 is safe and harmless.
  return (
    <tbody>
      {visible}
      {needsToggle && (
        <tr className="dash-showmore-row">
          <td colSpan={1000}>
            <button
              type="button"
              className="dash-showmore-btn"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : `Show all ${total} ${label}`}
            </button>
          </td>
        </tr>
      )}
    </tbody>
  );
}
