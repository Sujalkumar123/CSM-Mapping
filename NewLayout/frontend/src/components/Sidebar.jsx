import { useState } from 'react';
import { IconClients, IconPerson, IconSend, IconPlus, IconDownload, IconEdit } from './Icons';

export default function Sidebar({
  view, onViewChange,
  csm, onCsmChange,
  product, onProductChange,
  sort, onSortChange,
  onAddCsm, onExportCsv,
  csmNames = [],
  products = [],
  clients = []
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark">CS</div>
        <div className="brand-text">
          <div className="name">CSM Directory</div>
          <div className="sub">Client &amp; contact mapping</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="nav-group">
        <div className="nav-label">Views</div>
        <div
          className={`nav-item ${view === 'clients' ? 'active' : ''}`}
          onClick={() => onViewChange('clients')}
        >
          <IconClients />
          Clients
          <span className="nav-count">{clients.length}</span>
        </div>
        <div
          className={`nav-item ${view === 'csm' ? 'active' : ''}`}
          onClick={() => onViewChange('csm')}
        >
          <IconPerson />
          CSM Roster
          <span className="nav-count">{csmNames.length}</span>
        </div>
        <div
          className={`nav-item ${view === 'bulk' ? 'active bulk-active' : ''}`}
          onClick={() => onViewChange('bulk')}
        >
          <IconSend />
          Bulk Message
          <span className="nav-badge">New</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="field">
          <label htmlFor="filter-csm">CSM</label>
          <div className="select-wrap">
            <select id="filter-csm" value={csm} onChange={e => onCsmChange(e.target.value)}>
              <option>All CSMs</option>
              {csmNames.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-product">Product</label>
          <div className="select-wrap">
            <select id="filter-product" value={product} onChange={e => onProductChange(e.target.value)}>
              <option>All Products</option>
              {products.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-sort">Sort by</label>
          <div className="select-wrap">
            <select id="filter-sort" value={sort} onChange={e => onSortChange(e.target.value)}>
              <option value="csm-az">CSM name (A–Z)</option>
              <option value="csm-za">CSM name (Z–A)</option>
              <option value="co-az">Company name (A–Z)</option>
              <option value="co-za">Company name (Z–A)</option>
              <option value="id-asc">ID (Ascending)</option>
              <option value="id-desc">ID (Descending)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="nav-label" style={{ margin: '0 6px' }}>Role key</div>
        <div className="legend-row"><span className="dot" style={{ background: 'var(--cobalt)' }} />Primary CSM</div>
        <div className="legend-row"><span className="dot" style={{ background: 'var(--teal)' }} />Secondary CSM</div>
        <div className="legend-row"><span className="dot" style={{ background: 'var(--amber)' }} />Account lead</div>
      </div>

      {/* Edit / Remove panel */}
      <details className="edit-panel" open={editOpen} onToggle={(e) => setEditOpen(e.target.open)}>
        <summary>
          <IconEdit /> Edit / Remove CSM
        </summary>
        <div className="edit-panel-body">
          <div className="select-wrap">
            <select id="edit-record-select">
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.id}] {c.legalName} ({c.csm1?.name || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Edit record</button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--rose)', borderColor: 'var(--rose-soft)' }}>Remove</button>
          </div>
        </div>
      </details>

      {/* Actions */}
      <div className="sidebar-actions">
        <button className="btn btn-primary" onClick={onAddCsm}>
          <IconPlus /> Add new CSM
        </button>
        <button className="btn btn-ghost" onClick={onExportCsv}>
          <IconDownload /> Export CSV
        </button>
      </div>
    </aside>
  );
}
