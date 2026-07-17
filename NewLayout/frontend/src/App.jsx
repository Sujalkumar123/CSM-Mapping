import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import KpiStrip from './components/KpiStrip';
import SearchBar from './components/SearchBar';
import ClientCard from './components/ClientCard';
import RosterCard from './components/RosterCard';
import BulkMessageCenter from './components/BulkMessageCenter';
import AddCsmModal from './components/AddCsmModal';
import SlackSyncModal from './components/SlackSyncModal';

const API_BASE = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : 'https://csm-mapping-3.onrender.com');

export default function App() {
  const [clientsList, setClientsList] = useState([]);
  const [view, setView] = useState('clients');
  const [csm, setCsm] = useState('All CSMs');
  const [product, setProduct] = useState('All Products');
  const [sort, setSort] = useState('csm-az');
  const [search, setSearch] = useState('');
  const [kpi, setKpi] = useState('clients');
  const [shown, setShown] = useState(6);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);

  // Load clients data on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/clients`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClientsList(data);
        }
      })
      .catch(err => console.error("Error loading clients:", err));
  }, []);

  // Recalculate unique CSM names from live data
  const getLiveCsmNames = () => {
    const names = new Set();
    clientsList.forEach(c => {
      if (c.csm1?.name) names.add(c.csm1.name);
      if (c.csm2?.name) names.add(c.csm2.name);
    });
    return [...names].sort();
  };

  // Recalculate unique Products from live data
  const getLiveProducts = () => {
    return [...new Set(clientsList.map(c => c.product).filter(Boolean))].sort();
  };

  // Recalculate CSM roster / stats from live data
  const getLiveCsmDirectory = () => {
    const dir = {};
    clientsList.forEach(c => {
      [c.csm1, c.csm2].forEach(p => {
        if (p && p.name) {
          if (!dir[p.name] || (!dir[p.name].email && p.email)) {
            dir[p.name] = { ...p };
          }
        }
      });
    });
    return Object.entries(dir)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, info]) => ({ name, ...info }));
  };

  // Filter clients
  const getFiltered = () => {
    let list = clientsList.slice();

    // KPI filter
    if (kpi === 'phone') list = list.filter(c => c.csm1?.name && !c.csm1.phone);
    if (kpi === 'email') list = list.filter(c => c.csm1?.name && !c.csm1.email);

    // CSM filter
    if (csm !== 'All CSMs') {
      list = list.filter(c => c.csm1?.name === csm || c.csm2?.name === csm);
    }

    // Product filter
    if (product !== 'All Products') {
      list = list.filter(c => c.product === product);
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.legalName.toLowerCase().includes(q) ||
        c.csm1?.name?.toLowerCase().includes(q) ||
        c.csm2?.name?.toLowerCase().includes(q)
      );
    }

    // Sort
    const unassignedLast = (a, b) => (a.csm1?.name ? 0 : 1) - (b.csm1?.name ? 0 : 1);
    const comparators = {
      'csm-az': (a, b) => unassignedLast(a, b) || (a.csm1?.name || '').localeCompare(b.csm1?.name || ''),
      'csm-za': (a, b) => unassignedLast(a, b) || (b.csm1?.name || '').localeCompare(a.csm1?.name || ''),
      'co-az': (a, b) => unassignedLast(a, b) || a.legalName.localeCompare(b.legalName),
      'co-za': (a, b) => unassignedLast(a, b) || b.legalName.localeCompare(a.legalName),
      'id-asc': (a, b) => unassignedLast(a, b) || (+a.id - +b.id),
      'id-desc': (a, b) => unassignedLast(a, b) || (+b.id - +a.id),
    };
    list.sort(comparators[sort] || comparators['csm-az']);
    return list;
  };

  const getFilteredRoster = () => {
    let list = getLiveCsmDirectory();
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
      );
    }
    return list;
  };

  const filtered = getFiltered();
  const roster = getFilteredRoster();

  const handleKpiClick = (key) => {
    setKpi(key);
    if (key === 'csm') {
      setView('csm');
    } else {
      setView('clients');
    }
    setShown(6);
  };

  const handleExportCsv = () => {
    const rows = [["id", "legalName", "product", "csm1_name", "csm1_email", "csm1_phone", "csm2_name", "lead_name"]];
    clientsList.forEach(c => rows.push([
      c.id, c.legalName, c.product,
      c.csm1?.name || '', c.csm1?.email || '', c.csm1?.phone || '',
      c.csm2?.name || '', c.lead?.name || ''
    ]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'csm_directory.csv';
    a.click();
  };

  const handleEditClient = (id) => {
    const target = clientsList.find(c => c.id === id);
    if (target) {
      setEditingClient(target);
      setIsModalOpen(true);
    }
  };

  const handleRemoveClient = (id) => {
    const target = clientsList.find(c => c.id === id);
    if (!target) return;

    const confirmed = window.confirm(`Are you sure you want to remove the CSM assignment for "${target.legalName}" (ID ${id})?`);
    if (confirmed) {
      fetch(`${API_BASE}/api/clients/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setClientsList(prev => prev.filter(c => c.id !== id));
          } else {
            alert(`Failed to remove record: ${data.error || 'Unknown error'}`);
          }
        })
        .catch(err => {
          console.error("Error removing client:", err);
          alert("Error removing client record from server.");
        });
    }
  };

  const handleSaveCsm = (clientData) => {
    if (clientData.id) {
      // Edit operation
      fetch(`${API_BASE}/api/clients/${clientData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      })
        .then(res => res.json())
        .then(saved => {
          setClientsList(prev => prev.map(c => c.id === saved.id ? saved : c));
          setIsModalOpen(false);
          setEditingClient(null);
        })
        .catch(err => {
          console.error("Error updating record:", err);
          alert("Failed to update record.");
        });
    } else {
      // Create operation
      fetch(`${API_BASE}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      })
        .then(res => res.json())
        .then(saved => {
          setClientsList(prev => [...prev, saved]);
          setIsModalOpen(false);
        })
        .catch(err => {
          console.error("Error saving record:", err);
          alert("Failed to save new record.");
        });
    }
  };

  const pageTitles = {
    clients: ['Client & CSM directory', 'Find who owns an account and reach them in one tap.'],
    csm: ['CSM roster', 'Every CSM in one place, with their live account load.'],
    bulk: ['Bulk message center', 'Message a whole segment of CSMs at once — one draft, every channel.']
  };

  const activeKpiNotes = {
    clients: '',
    csm: '',
    phone: 'Filtered — missing phone',
    email: 'Filtered — missing email'
  };

  return (
    <div className="shell">
      <Sidebar
        view={view}
        onViewChange={setView}
        csm={csm}
        onCsmChange={setCsm}
        product={product}
        onProductChange={setProduct}
        sort={sort}
        onSortChange={setSort}
        onAddCsm={() => { setEditingClient(null); setIsModalOpen(true); }}
        onExportCsv={handleExportCsv}
        onEditClient={handleEditClient}
        onRemoveClient={handleRemoveClient}
        onSlackSync={() => setIsSlackModalOpen(true)}
        csmNames={getLiveCsmNames()}
        products={getLiveProducts()}
        clients={clientsList}
      />

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{pageTitles[view][0]}</h1>
            <p className="desc">{pageTitles[view][1]}</p>
          </div>
          {view !== 'bulk' && (
            <SearchBar onSearch={setSearch} clientsList={clientsList} />
          )}
        </div>

        {view !== 'bulk' && (
          <KpiStrip
            activeKpi={kpi}
            onKpiClick={handleKpiClick}
            clientsList={clientsList}
            csmNames={getLiveCsmNames()}
          />
        )}

        {view !== 'bulk' && (
          <div className="results-row">
            <div className="results-count">
              Showing <b>{view === 'clients' ? Math.min(shown, filtered.length) : roster.length}</b> of <b>{view === 'clients' ? filtered.length : roster.length}</b> records
            </div>
            <div className="sort-inline">{activeKpiNotes[kpi]}</div>
          </div>
        )}

        {view === 'clients' && (
          <section id="view-clients">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="glyph">🗂️</div>
                <div className="title">No matching records</div>
                Try clearing filters or search.
              </div>
            ) : (
              <>
                <div className="cards">
                  {filtered.slice(0, shown).map(c => (
                    <ClientCard key={c.id} client={c} />
                  ))}
                </div>
                {shown < filtered.length && (
                  <div className="load-more">
                    <button onClick={() => setShown(prev => prev + 6)}>Load more records…</button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {view === 'csm' && (
          <section id="view-csm">
            <div className="roster-grid">
              {roster.map(p => (
                <RosterCard key={p.name} person={p} clientsList={clientsList} />
              ))}
            </div>
          </section>
        )}

        {view === 'bulk' && (
          <BulkMessageCenter clientsList={clientsList} roster={roster} API_BASE={API_BASE} />
        )}
      </main>

      <AddCsmModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingClient(null); }}
        onSave={handleSaveCsm}
        editingClient={editingClient}
        roster={roster}
      />

      <SlackSyncModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        onSyncComplete={(updatedClients) => setClientsList(updatedClients)}
        API_BASE={API_BASE}
      />
    </div>
  );
}
