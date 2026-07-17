import { useState, useRef, useEffect } from 'react';
import { IconClients, IconPerson, IconSend, IconPlus, IconDownload, IconEdit, IconSlack } from './Icons';

export default function Sidebar({
  view, onViewChange,
  csm, onCsmChange,
  product, onProductChange,
  sort, onSortChange,
  onAddCsm, onExportCsv,
  onEditClient, onRemoveClient,
  onSlackSync,
  csmNames = [],
  products = [],
  clients = []
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedEditId, setSelectedEditId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleEditClick = () => {
    if (!selectedEditId) {
      alert("Please search and select a company first from the dropdown list.");
      return;
    }
    onEditClient(selectedEditId);
  };

  const handleRemoveClick = () => {
    if (!selectedEditId) {
      alert("Please search and select a company first from the dropdown list.");
      return;
    }
    onRemoveClient(selectedEditId);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedEditId(''); // Clear selected ID since the text changed
    setIsDropdownOpen(true);
  };

  const handleSelectClient = (c) => {
    setSelectedEditId(c.id);
    setSearchQuery(`[${c.id}] ${c.legalName}`);
    setIsDropdownOpen(false);
  };

  // Filter dropdown recommendations dynamically (limit to 30 options)
  const filteredOptions = clients
    .filter(c => {
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      return (
        c.legalName.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        (c.csm1?.name || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 30);

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
          <div className="edit-search-wrap" ref={dropdownRef}>
            <input
              type="text"
              className="edit-search-input"
              placeholder="Search company to edit/remove..."
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => setIsDropdownOpen(true)}
            />
            {isDropdownOpen && (
              <div className="edit-dropdown-panel">
                {filteredOptions.length === 0 ? (
                  <div className="edit-dropdown-empty">No matches found</div>
                ) : (
                  filteredOptions.map(c => (
                    <div
                      key={c.id}
                      className="edit-dropdown-option"
                      onClick={() => handleSelectClient(c)}
                    >
                      [{c.id}] {c.legalName} ({c.csm1?.name || 'Unassigned'})
                    </div>
                  ))
                )}
              </div>
            )}
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
        <button className="btn btn-ghost" onClick={onSlackSync} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--violet-ink)', borderColor: 'rgba(139,92,246,0.35)' }}>
          <IconSlack size={14} stroke="var(--violet-ink)" strokeWidth="2.2" /> Sync Slack IDs
        </button>
        <button className="btn btn-ghost" onClick={onExportCsv}>
          <IconDownload /> Export CSV
        </button>
      </div>
    </aside>
  );
}
