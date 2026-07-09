import { useState } from 'react';
import { IconClients, IconPerson, IconSend, IconPlus, IconDownload, IconEdit } from './Icons';

export default function Sidebar({
  view, onViewChange,
  csm, onCsmChange,
  product, onProductChange,
  sort, onSortChange,
  onAddCsm, onExportCsv,
  onEditClient, onRemoveClient,
  csmNames = [],
  products = [],
  clients = []
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEditId, setSelectedEditId] = useState('');

  const handleEditClick = () => {
    const id = selectedEditId || (clients[0]?.id || '');
    if (id) {
      onEditClient(id);
    }
  };

  const handleRemoveClick = () => {
    const id = selectedEditId || (clients[0]?.id || '');
    if (id) {
      onRemoveClient(id);
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark"><span>CS</span></div>
        <div className="brand-text">
          <div className="name">
            CSM Directory <span className="pulse"></span>
          </div>
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
          className={`nav-item ${view === 'bulk' ? 'active' : ''}`}
          data-view="bulk"
          onClick={() => onViewChange('bulk')}
        >
          <IconSend />
          Custom Message
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="field">
          <label htmlFor="filter-csm">CSM</label>
          <div className="select">
            <select id="filter-csm" value={csm} onChange={e => onCsmChange(e.target.value)}>
              <option>All CSMs</option>
              {csmNames.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-product">Product</label>
          <div className="select">
            <select id="filter-product" value={product} onChange={e => onProductChange(e.target.value)}>
              <option>All Products</option>
              {products.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-sort">Sort by</label>
          <div className="select">
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

      {/* Edit / Remove panel */}
      <details className="edit-panel" open={editOpen} onToggle={(e) => setEditOpen(e.target.open)}>
        <summary>
          <IconEdit /> Edit / Remove CSM
        </summary>
        <div className="edit-panel-body">
          <div className="select">
            <select
              id="edit-record-select"
              value={selectedEditId || (clients[0]?.id || '')}
              onChange={e => setSelectedEditId(e.target.value)}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.id}] {c.legalName} ({c.csm1?.name || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleEditClick}
              className="btn btn-ghost btn-sm"
              style={{ flex: 1 }}
              disabled={clients.length === 0}
            >
              Edit record
            </button>
            <button
              onClick={handleRemoveClick}
              className="btn btn-ghost btn-sm"
              style={{ flex: 1, color: '#F79FAF', borderColor: 'rgba(240,69,104,.35)' }}
              disabled={clients.length === 0}
            >
              Remove
            </button>
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
