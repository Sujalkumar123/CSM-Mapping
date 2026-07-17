import { useState, useEffect } from 'react';
import { IconClose } from './Icons';

export default function AddCsmModal({ isOpen, onClose, onSave, editingClient, roster = [] }) {
  // Form states
  const [legalName, setLegalName] = useState('');
  const [product, setProduct] = useState('');

  // Primary CSM
  const [csm1Name, setCsm1Name] = useState('');
  const [csm1Phone, setCsm1Phone] = useState('');
  const [csm1Email, setCsm1Email] = useState('');
  const [csm1Slack, setCsm1Slack] = useState('');
  const [phoneBlank, setPhoneBlank] = useState(false);
  const [emailBlank, setEmailBlank] = useState(false);

  // Secondary CSM
  const [csm2Name, setCsm2Name] = useState('');
  const [csm2Phone, setCsm2Phone] = useState('');
  const [csm2Email, setCsm2Email] = useState('');
  const [csm2Slack, setCsm2Slack] = useState('');

  // Account Lead
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');

  // Autocomplete suggestion states
  const [csm1Suggestions, setCsm1Suggestions] = useState([]);
  const [showCsm1Suggestions, setShowCsm1Suggestions] = useState(false);
  const [csm2Suggestions, setCsm2Suggestions] = useState([]);
  const [showCsm2Suggestions, setShowCsm2Suggestions] = useState(false);
  const [leadSuggestions, setLeadSuggestions] = useState([]);
  const [showLeadSuggestions, setShowLeadSuggestions] = useState(false);

  // Email autocomplete states
  const [csm1EmailSuggestions, setCsm1EmailSuggestions] = useState([]);
  const [showCsm1EmailSuggestions, setShowCsm1EmailSuggestions] = useState(false);
  const [csm2EmailSuggestions, setCsm2EmailSuggestions] = useState([]);
  const [showCsm2EmailSuggestions, setShowCsm2EmailSuggestions] = useState(false);
  const [leadEmailSuggestions, setLeadEmailSuggestions] = useState([]);
  const [showLeadEmailSuggestions, setShowLeadEmailSuggestions] = useState(false);

  const getEmailSuggestions = (value) => {
    if (!value || value.trim().length < 1) return [];
    const q = value.toLowerCase();
    
    const matches = roster.filter(p => 
      (p.email && p.email.toLowerCase().includes(q)) || 
      p.name.toLowerCase().includes(q)
    );
    
    const cleanName = value.trim().toLowerCase().split('@')[0].replace(/\s+/g, '.');
    const orgDomains = ['flick2know.com', 'fieldassist.in', 'qartsolutions.com'];
    const generated = [];
    
    if (cleanName.length > 2 && !value.includes('@')) {
      orgDomains.forEach(domain => {
        const orgEmail = `${cleanName}@${domain}`;
        const exists = matches.some(m => m.email && m.email.toLowerCase() === orgEmail.toLowerCase());
        if (!exists) {
          generated.push({
            name: value.split('@')[0],
            email: orgEmail,
            phone: '',
            slack: '',
            type: 'generate'
          });
        }
      });
    }
    
    return [...matches.map(m => ({ ...m, type: 'roster' })), ...generated];
  };

  const renderEmailDropdown = (suggestions, onSelect, show) => {
    if (!show || suggestions.length === 0) return null;
    const colors = ['#0078d4', '#107c41', '#d83b01', '#8764b8', '#e3008c', '#00b7c3'];
    const getBgColor = (name) => {
      const idx = name.charCodeAt(0) % colors.length;
      return colors[idx];
    };
    
    return (
      <div className="suggestions-dropdown" style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: 'var(--surface)',
        border: '1px solid var(--line-strong)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 20,
        maxHeight: '220px',
        overflowY: 'auto',
        marginTop: '4px'
      }}>
        {suggestions.map((s, idx) => {
          const initial = s.name ? s.name.charAt(0).toUpperCase() : s.email.charAt(0).toUpperCase();
          const displayName = s.name || s.email.split('@')[0];
          const bg = getBgColor(displayName);
          
          return (
            <div
              key={idx}
              className="suggestion-item"
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--line-faint)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'background 0.15s ease'
              }}
              onMouseDown={() => onSelect(s)}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-under)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: bg,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '14px',
                flexShrink: 0
              }}>
                {initial}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: '1.3' }}>
                <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--ink)' }}>
                  {displayName}
                </span>
                <span style={{ color: 'var(--ink-soft)', fontSize: '11px' }}>
                  {s.email}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getSuggestions = (value) => {
    if (!value || value.trim().length < 2) return [];
    const q = value.toLowerCase();
    const matches = roster.filter(p => p.name.toLowerCase().includes(q));
    
    const cleanName = value.trim().toLowerCase().replace(/\s+/g, '.');
    const orgEmail = `${cleanName}@flick2know.com`;
    const hasOrgEmailMatch = matches.some(m => m.email && m.email.toLowerCase() === orgEmail.toLowerCase());
    
    const results = [...matches.map(m => ({ ...m, type: 'roster' }))];
    if (!hasOrgEmailMatch && cleanName.length > 2) {
      results.push({
        name: value.trim(),
        email: orgEmail,
        phone: '',
        slack: '',
        type: 'generate'
      });
    }
    return results;
  };

  const selectCsm1Suggestion = (s) => {
    setCsm1Name(s.name);
    if (s.email) {
      setCsm1Email(s.email);
      setEmailBlank(false);
    }
    if (s.phone) {
      setCsm1Phone(s.phone);
      setPhoneBlank(false);
    }
    if (s.slack) {
      setCsm1Slack(s.slack);
    }
    setShowCsm1Suggestions(false);
  };

  const selectCsm2Suggestion = (s) => {
    setCsm2Name(s.name);
    if (s.email) setCsm2Email(s.email);
    if (s.phone) setCsm2Phone(s.phone);
    if (s.slack) setCsm2Slack(s.slack);
    setShowCsm2Suggestions(false);
  };

  const selectLeadSuggestion = (s) => {
    setLeadName(s.name);
    if (s.email) setLeadEmail(s.email);
    if (s.phone) setLeadPhone(s.phone);
    setShowLeadSuggestions(false);
  };

  // Synchronize state when editingClient or isOpen changes
  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        setLegalName(editingClient.legalName || '');
        setProduct(editingClient.product || '');

        setCsm1Name(editingClient.csm1?.name || '');
        setCsm1Phone(editingClient.csm1?.phone || '');
        setCsm1Email(editingClient.csm1?.email || '');
        setCsm1Slack(editingClient.csm1?.slack || '');
        setPhoneBlank(!editingClient.csm1?.phone);
        setEmailBlank(!editingClient.csm1?.email);

        setCsm2Name(editingClient.csm2?.name || '');
        setCsm2Phone(editingClient.csm2?.phone || '');
        setCsm2Email(editingClient.csm2?.email || '');
        setCsm2Slack(editingClient.csm2?.slack || '');

        setLeadName(editingClient.lead?.name || '');
        setLeadPhone(editingClient.lead?.phone || '');
        setLeadEmail(editingClient.lead?.email || '');
      } else {
        // Reset form for "Add" mode
        setLegalName('');
        setProduct('');

        setCsm1Name('');
        setCsm1Phone('');
        setCsm1Email('');
        setCsm1Slack('');
        setPhoneBlank(false);
        setEmailBlank(false);

        setCsm2Name('');
        setCsm2Phone('');
        setCsm2Email('');
        setCsm2Slack('');

        setLeadName('');
        setLeadPhone('');
        setLeadEmail('');
      }
    }
  }, [isOpen, editingClient]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!legalName.trim()) {
      alert("Company legal name is required.");
      return;
    }
    if (!csm1Name.trim()) {
      alert("Primary CSM name is required.");
      return;
    }

    const payload = {
      legalName: legalName.trim(),
      product: product.trim(),
      csm1: {
        name: csm1Name.trim(),
        phone: phoneBlank ? '' : csm1Phone.trim(),
        email: emailBlank ? '' : csm1Email.trim(),
        slack: csm1Slack.trim()
      },
      csm2: {
        name: csm2Name.trim(),
        phone: csm2Phone.trim(),
        email: csm2Email.trim(),
        slack: csm2Slack.trim()
      },
      lead: {
        name: leadName.trim(),
        phone: leadPhone.trim(),
        email: leadEmail.trim()
      }
    };

    if (editingClient) {
      payload.id = editingClient.id;
    }

    onSave(payload);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{editingClient ? 'Edit CSM assignment' : 'Add new CSM assignment'}</h3>
          <div className="modal-close" onClick={onClose}>
            <IconClose />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {/* Section: Account */}
          <div className="form-section">
            <div className="section-title">Account</div>
            <div className="form-row single">
              <div className="form-field">
                <label>Company (legal name) *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={legalName}
                  onChange={e => setLegalName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row single">
              <div className="form-field">
                <label>Product</label>
                <input
                  type="text"
                  placeholder="e.g. Retail Suite"
                  value={product}
                  onChange={e => setProduct(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Primary CSM */}
          <div className="form-section">
            <div className="section-title">Primary CSM</div>
            <div className="form-row">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Aditi Rao"
                  value={csm1Name}
                  onChange={e => {
                    const val = e.target.value;
                    setCsm1Name(val);
                    setCsm1Suggestions(getSuggestions(val));
                    setShowCsm1Suggestions(true);
                  }}
                  onFocus={() => {
                    setCsm1Suggestions(getSuggestions(csm1Name));
                    setShowCsm1Suggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCsm1Suggestions(false), 200);
                  }}
                  required
                  autoComplete="off"
                />
                
                {showCsm1Suggestions && csm1Suggestions.length > 0 && (
                  <div className="suggestions-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginTop: '4px'
                  }}>
                    {csm1Suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderBottom: idx < csm1Suggestions.length - 1 ? '1px solid var(--line-faint)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseDown={() => selectCsm1Suggestion(s)}
                        onMouseEnter={(e) => e.target.style.background = 'var(--surface-under)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: '500', color: 'var(--ink)' }}>{s.name}</span>
                          <span style={{ color: 'var(--ink-soft)', fontSize: '11px', marginLeft: '8px' }}>
                            {s.email}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: s.type === 'roster' ? 'var(--violet-soft)' : 'var(--emerald-soft)',
                          color: s.type === 'roster' ? 'var(--violet)' : 'var(--emerald)'
                        }}>
                          {s.type === 'roster' ? 'Existing' : 'Auto @flick2know'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={phoneBlank ? '' : csm1Phone}
                  onChange={e => setCsm1Phone(e.target.value)}
                  disabled={phoneBlank}
                />
              </div>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="phone-blank-cb"
                checked={phoneBlank}
                onChange={e => setPhoneBlank(e.target.checked)}
              />
              <label htmlFor="phone-blank-cb">Mark phone as blank</label>
            </div>
            <div className="form-row">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>Email</label>
                <input
                  type="text"
                  placeholder="name@company.com"
                  value={emailBlank ? '' : csm1Email}
                  onChange={e => {
                    const val = e.target.value;
                    setCsm1Email(val);
                    setCsm1EmailSuggestions(getEmailSuggestions(val));
                    setShowCsm1EmailSuggestions(true);
                  }}
                  onFocus={() => {
                    setCsm1EmailSuggestions(getEmailSuggestions(csm1Email));
                    setShowCsm1EmailSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCsm1EmailSuggestions(false), 200);
                  }}
                  disabled={emailBlank}
                  autoComplete="off"
                />
                {renderEmailDropdown(csm1EmailSuggestions, selectCsm1Suggestion, showCsm1EmailSuggestions)}
              </div>
              <div className="form-field">
                <label>Slack member ID</label>
                <input
                  type="text"
                  placeholder="U05AB12CD"
                  value={csm1Slack}
                  onChange={e => setCsm1Slack(e.target.value)}
                />
              </div>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="email-blank-cb"
                checked={emailBlank}
                onChange={e => setEmailBlank(e.target.checked)}
              />
              <label htmlFor="email-blank-cb">Mark email as blank</label>
            </div>
          </div>

          {/* Section: Secondary CSM */}
          <div className="form-section">
            <div className="section-title">Secondary CSM (optional)</div>
            <div className="form-row">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={csm2Name}
                  onChange={e => {
                    const val = e.target.value;
                    setCsm2Name(val);
                    setCsm2Suggestions(getSuggestions(val));
                    setShowCsm2Suggestions(true);
                  }}
                  onFocus={() => {
                    setCsm2Suggestions(getSuggestions(csm2Name));
                    setShowCsm2Suggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCsm2Suggestions(false), 200);
                  }}
                  autoComplete="off"
                />
                
                {showCsm2Suggestions && csm2Suggestions.length > 0 && (
                  <div className="suggestions-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginTop: '4px'
                  }}>
                    {csm2Suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderBottom: idx < csm2Suggestions.length - 1 ? '1px solid var(--line-faint)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseDown={() => selectCsm2Suggestion(s)}
                        onMouseEnter={(e) => e.target.style.background = 'var(--surface-under)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: '500', color: 'var(--ink)' }}>{s.name}</span>
                          <span style={{ color: 'var(--ink-soft)', fontSize: '11px', marginLeft: '8px' }}>
                            {s.email}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: s.type === 'roster' ? 'var(--violet-soft)' : 'var(--emerald-soft)',
                          color: s.type === 'roster' ? 'var(--violet)' : 'var(--emerald)'
                        }}>
                          {s.type === 'roster' ? 'Existing' : 'Auto @flick2know'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input
                  type="text"
                  value={csm2Phone}
                  onChange={e => setCsm2Phone(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>Email</label>
                <input
                  type="text"
                  placeholder="name@company.com"
                  value={csm2Email}
                  onChange={e => {
                    const val = e.target.value;
                    setCsm2Email(val);
                    setCsm2EmailSuggestions(getEmailSuggestions(val));
                    setShowCsm2EmailSuggestions(true);
                  }}
                  onFocus={() => {
                    setCsm2EmailSuggestions(getEmailSuggestions(csm2Email));
                    setShowCsm2EmailSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCsm2EmailSuggestions(false), 200);
                  }}
                  autoComplete="off"
                />
                {renderEmailDropdown(csm2EmailSuggestions, selectCsm2Suggestion, showCsm2EmailSuggestions)}
              </div>
              <div className="form-field">
                <label>Slack member ID</label>
                <input
                  type="text"
                  value={csm2Slack}
                  onChange={e => setCsm2Slack(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Account Lead */}
          <div className="form-section">
            <div className="section-title">Account lead (optional)</div>
            <div className="form-row">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Sen"
                  value={leadName}
                  onChange={e => {
                    const val = e.target.value;
                    setLeadName(val);
                    setLeadSuggestions(getSuggestions(val));
                    setShowLeadSuggestions(true);
                  }}
                  onFocus={() => {
                    setLeadSuggestions(getSuggestions(leadName));
                    setShowLeadSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowLeadSuggestions(false), 200);
                  }}
                  autoComplete="off"
                />
                
                {showLeadSuggestions && leadSuggestions.length > 0 && (
                  <div className="suggestions-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    marginTop: '4px'
                  }}>
                    {leadSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderBottom: idx < leadSuggestions.length - 1 ? '1px solid var(--line-faint)' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseDown={() => selectLeadSuggestion(s)}
                        onMouseEnter={(e) => e.target.style.background = 'var(--surface-under)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div>
                          <span style={{ fontWeight: '500', color: 'var(--ink)' }}>{s.name}</span>
                          <span style={{ color: 'var(--ink-soft)', fontSize: '11px', marginLeft: '8px' }}>
                            {s.email}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: s.type === 'roster' ? 'var(--violet-soft)' : 'var(--emerald-soft)',
                          color: s.type === 'roster' ? 'var(--violet)' : 'var(--emerald)'
                        }}>
                          {s.type === 'roster' ? 'Existing' : 'Auto @flick2know'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input
                  type="text"
                  value={leadPhone}
                  onChange={e => setLeadPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row single">
              <div className="form-field" style={{ position: 'relative' }}>
                <label>Email</label>
                <input
                  type="text"
                  placeholder="name@company.com"
                  value={leadEmail}
                  onChange={e => {
                    const val = e.target.value;
                    setLeadEmail(val);
                    setLeadEmailSuggestions(getEmailSuggestions(val));
                    setShowLeadEmailSuggestions(true);
                  }}
                  onFocus={() => {
                    setLeadEmailSuggestions(getEmailSuggestions(leadEmail));
                    setShowLeadEmailSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowLeadEmailSuggestions(false), 200);
                  }}
                  autoComplete="off"
                />
                {renderEmailDropdown(leadEmailSuggestions, selectLeadSuggestion, showLeadEmailSuggestions)}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save CSM</button>
          </div>
        </form>
      </div>
    </div>
  );
}
