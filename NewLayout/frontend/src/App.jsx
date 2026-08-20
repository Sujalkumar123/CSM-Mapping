import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import KpiStrip from './components/KpiStrip';
import SearchBar from './components/SearchBar';
import ClientCard from './components/ClientCard';
import RosterCard from './components/RosterCard';
import BulkMessageCenter from './components/BulkMessageCenter';
import AddCsmModal from './components/AddCsmModal';
import SlackSyncModal from './components/SlackSyncModal';
import EmailConfigModal from './components/EmailConfigModal';
import WhatsAppConnectModal from './components/WhatsAppConnectModal';
import UnifiedInbox from './components/UnifiedInbox';

const API_BASE = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : 'https://csm-mapping-3.onrender.com');

const VIEWS = ['clients', 'csm', 'inbox', 'bulk'];
const KPIS = ['clients', 'csm', 'phone', 'email'];
const SORTS = ['csm-az', 'csm-za', 'co-az', 'co-za', 'id-asc', 'id-desc'];

// The URL is the source of truth for where you were, so a refresh lands back
// on the same tab with the same filters instead of bouncing to Clients.
// Everything is validated against a whitelist — a hand-edited ?view=garbage
// would otherwise blow up the pageTitles lookup.
function readUrlState() {
  const p = new URLSearchParams(window.location.search);
  const pick = (key, allowed, fallback) => {
    const v = p.get(key);
    return allowed.includes(v) ? v : fallback;
  };
  return {
    view: pick('view', VIEWS, 'clients'),
    kpi: pick('kpi', KPIS, 'clients'),
    sort: pick('sort', SORTS, 'csm-az'),
    csm: p.get('csm') || 'All CSMs',
    product: p.get('product') || 'All Products',
    search: p.get('q') || '',
    person: p.get('person') || null
  };
}

const initialUrl = readUrlState();

export default function App() {
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(initialUrl.view);
  const [csm, setCsm] = useState(initialUrl.csm);
  const [product, setProduct] = useState(initialUrl.product);
  const [sort, setSort] = useState(initialUrl.sort);
  const [search, setSearch] = useState(initialUrl.search);
  const [kpi, setKpi] = useState(initialUrl.kpi);
  const [personKey, setPersonKey] = useState(initialUrl.person);
  const [shown, setShown] = useState(6);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');

  // Load clients data on mount
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/clients`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClientsList(data);
        }
      })
      .catch(err => console.error("Error loading clients:", err))
      .finally(() => setLoading(false));
  }, []);

  // Mirror navigation state into the query string. replaceState (not push)
  // so filter tweaks don't pile up dozens of back-button entries.
  useEffect(() => {
    const p = new URLSearchParams();
    if (view !== 'clients') p.set('view', view);
    if (kpi !== 'clients') p.set('kpi', kpi);
    if (sort !== 'csm-az') p.set('sort', sort);
    if (csm !== 'All CSMs') p.set('csm', csm);
    if (product !== 'All Products') p.set('product', product);
    if (search) p.set('q', search);
    if (personKey) p.set('person', personKey);

    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [view, kpi, sort, csm, product, search, personKey]);

  // One status poll shared by the sidebar badge and the connect modal,
  // instead of every consumer running its own interval
  useEffect(() => {
    const check = () => {
      fetch(`${API_BASE}/api/whatsapp/status`)
        .then(res => res.json())
        .then(data => setWhatsappStatus(data.status))
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, 4000);
    return () => clearInterval(timer);
  }, []);

  // The source sheet has the same person spelled multiple ways across rows
  // — typos and inconsistent capitalization ("Suvarna Choudhary" /
  // "Suvarna Chaudhary" / "Suvarna chaudhary" is one real example, found
  // in 12 of the 80 CSMs). Grouping by raw name string shows each spelling
  // as its own separate CSM, so every place that needs "is this the same
  // person" — the directory, the filter dropdown, and the filter itself —
  // uses this same email/phone-first key instead.
  const csmIdentityKey = (p) => (p?.email || p?.phone || p?.name || '').toLowerCase().trim();

  // Recalculate unique CSM names from live data
  const getLiveCsmNames = () => {
    const byKey = new Map();
    clientsList.forEach(c => {
      [c.csm1, c.csm2].forEach(p => {
        if (!p || !p.name) return;
        const key = csmIdentityKey(p);
        if (!byKey.has(key)) byKey.set(key, p.name);
      });
    });
    return [...byKey.values()].sort();
  };

  // Recalculate unique Products from live data
  const getLiveProducts = () => {
    return [...new Set(clientsList.map(c => c.product).filter(Boolean))].sort();
  };

  // Recalculate CSM roster / stats from live data
  const getLiveCsmDirectory = () => {
    const dir = new Map();
    clientsList.forEach(c => {
      [c.csm1, c.csm2].forEach(p => {
        if (!p || !p.name) return;
        const key = csmIdentityKey(p);
        const existing = dir.get(key);
        if (!existing) {
          dir.set(key, { ...p });
        } else {
          if (!existing.email && p.email) existing.email = p.email;
          if (!existing.phone && p.phone) existing.phone = p.phone;
          if (!existing.slack && p.slack) existing.slack = p.slack;
        }
      });
    });
    return [...dir.values()].sort((a, b) => a.name.localeCompare(b.name));
  };

  // The CSM filter dropdown offers one canonical spelling per person (from
  // getLiveCsmNames above) — this resolves it back to that person's full
  // set of name spellings, so selecting it doesn't miss rows that use a
  // different spelling of the same email/phone identity.
  const getNamesForCsmFilter = (selectedName) => {
    if (selectedName === 'All CSMs') return null;
    const targetKey = (() => {
      for (const c of clientsList) {
        for (const p of [c.csm1, c.csm2]) {
          if (p?.name === selectedName) return csmIdentityKey(p);
        }
      }
      return null;
    })();
    if (!targetKey) return new Set([selectedName]);
    const names = new Set();
    clientsList.forEach(c => {
      [c.csm1, c.csm2].forEach(p => {
        if (p?.name && csmIdentityKey(p) === targetKey) names.add(p.name);
      });
    });
    return names;
  };

  // Filter clients
  const getFiltered = () => {
    let list = clientsList.slice();

    // KPI filter
    if (kpi === 'phone') list = list.filter(c => c.csm1?.name && !c.csm1.phone);
    if (kpi === 'email') list = list.filter(c => c.csm1?.name && !c.csm1.email);

    // CSM filter — matches every spelling of the selected person, not just
    // the one exact string shown in the dropdown
    if (csm !== 'All CSMs') {
      const names = getNamesForCsmFilter(csm);
      list = list.filter(c => names.has(c.csm1?.name) || names.has(c.csm2?.name));
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
    bulk: ['Bulk message center', 'Message a whole segment of CSMs at once — one draft, every channel.'],
    inbox: ['Inbox', 'WhatsApp, Slack and email with one person — side by side, no app switching.']
  };

  const showDirectoryChrome = view !== 'bulk' && view !== 'inbox';

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
        onEmailConfig={() => setIsEmailModalOpen(true)}
        onWhatsAppConnect={() => setIsWhatsAppModalOpen(true)}
        whatsappStatus={whatsappStatus}
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
          {showDirectoryChrome && (
            <SearchBar onSearch={setSearch} clientsList={clientsList} initialQuery={initialUrl.search} />
          )}
        </div>

        {showDirectoryChrome && (
          <KpiStrip
            activeKpi={kpi}
            onKpiClick={handleKpiClick}
            clientsList={clientsList}
            csmNames={getLiveCsmNames()}
          />
        )}

        {showDirectoryChrome && (
          <div className="results-row">
            <div className="results-count">
              Showing <b>{view === 'clients' ? Math.min(shown, filtered.length) : roster.length}</b> of <b>{view === 'clients' ? filtered.length : roster.length}</b> records
            </div>
            <div className="sort-inline">{activeKpiNotes[kpi]}</div>
          </div>
        )}

        {view === 'clients' && (
          <section id="view-clients">
            {loading ? (
              <div className="cards">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-title"></div>
                    <div className="skeleton-badge"></div>
                    <div className="skeleton-body"></div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
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

        {view === 'inbox' && (
          <UnifiedInbox
            clientsList={clientsList}
            API_BASE={API_BASE}
            selectedKey={personKey}
            onSelectPerson={setPersonKey}
            onConnectWhatsApp={() => setIsWhatsAppModalOpen(true)}
          />
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

      <EmailConfigModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        API_BASE={API_BASE}
      />

      <WhatsAppConnectModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        API_BASE={API_BASE}
      />
    </div>
  );
}
