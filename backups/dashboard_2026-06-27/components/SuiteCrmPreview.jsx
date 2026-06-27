'use client';

const FAKE_LEADS = [
  { name: 'Yossi Levi',   phone: '054-234-5678', source: 'Web Site', status: 'in-process', statusLabel: 'In Process', date: '24/05/2026' },
  { name: 'Dana Cohen',   phone: '052-876-5432', source: 'Web Site', status: 'assigned',   statusLabel: 'Assigned',   date: '25/05/2026' },
  { name: 'Avi Mizrahi',  phone: '050-111-2222', source: 'Web Site', status: 'new',        statusLabel: 'New',        date: '26/05/2026' },
];

function today() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/**
 * HTML/CSS mockup of the SuiteCRM Leads list view.
 * liveSubmission: { name: string, phone: string } | null
 * When truthy, a highlighted live row is prepended to the table.
 */
export default function SuiteCrmPreview({ liveSubmission }) {
  const totalCount = FAKE_LEADS.length + (liveSubmission ? 1 : 0);

  return (
    <div className="crm-suite-preview">

      {/* ── Header bar ── */}
      <div className="crm-suite-header">
        <div className="crm-suite-header-left">
          <div className="crm-suite-logo">S</div>
          <span className="crm-suite-module">SuiteCRM — Leads</span>
        </div>
        <span className="crm-suite-live-badge">
          <span className="crm-suite-live-dot" />
          Live
        </span>
      </div>

      {/* ── Toolbar ── */}
      <div className="crm-suite-toolbar">
        <span className="crm-suite-toolbar-title">All Leads ({totalCount})</span>
        <span className="crm-suite-toolbar-btn">+ Create Lead</span>
      </div>

      {/* ── Table ── */}
      <div className="crm-suite-table-wrap">
        <table className="crm-suite-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {/* Live row — appears after successful form submission */}
            {liveSubmission && (
              <tr className="crm-suite-live-row">
                <td>
                  <span className="crm-suite-live-dot-inline" />
                  {liveSubmission.name}
                </td>
                <td>{liveSubmission.phone}</td>
                <td>Web Site</td>
                <td><span className="crm-suite-status new">New</span></td>
                <td>{today()}</td>
              </tr>
            )}

            {/* Hardcoded existing leads */}
            {FAKE_LEADS.map((lead) => (
              <tr key={lead.name}>
                <td>{lead.name}</td>
                <td>{lead.phone}</td>
                <td>{lead.source}</td>
                <td>
                  <span className={`crm-suite-status ${lead.status}`}>
                    {lead.statusLabel}
                  </span>
                </td>
                <td>{lead.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Hint when no live submission yet ── */}
      {!liveSubmission && (
        <div className="crm-suite-hint">
          Submit the form — your lead appears here in real time
        </div>
      )}
    </div>
  );
}
