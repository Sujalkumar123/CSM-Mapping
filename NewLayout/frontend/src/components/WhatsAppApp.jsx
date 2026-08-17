import { useState, useEffect, useMemo, memo } from 'react';
import { getInitials } from '../data/clients';
import { buildPeople, getAvatarColor } from '../data/people';
import { IconWhatsApp, IconSearch } from './Icons';
import WhatsAppChatBox from './WhatsAppChatBox';

function formatPreviewTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const ContactRow = memo(function ContactRow({ person, active, onSelect }) {
  const preview = person.lastMessage;
  return (
    <div
      onClick={() => onSelect(person.key)}
      style={{
        display: 'flex', alignItems: 'center', gap: '11px',
        padding: '11px 14px', cursor: 'pointer',
        background: active ? 'var(--violet-soft, #f2ecff)' : 'transparent',
        borderBottom: '1px solid var(--line-faint, #ececef)'
      }}
    >
      <div style={{
        width: '42px', height: '42px', borderRadius: '50%',
        background: getAvatarColor(person.name), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 700, flexShrink: 0
      }}>
        {getInitials(person.name)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.name}
          </span>
          {preview && (
            <span style={{ fontSize: '10.5px', color: 'var(--ink-faint, #8a8a99)', flexShrink: 0 }}>
              {formatPreviewTime(preview.timestamp)}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '12px', color: preview ? 'var(--ink-soft, #666)' : 'var(--ink-faint, #8a8a99)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px'
        }}>
          {preview
            ? `${preview.fromMe ? 'You: ' : ''}${preview.body || '(media)'}`
            : person.role + ' · no messages yet'}
        </div>
      </div>
    </div>
  );
});

export default function WhatsAppApp({ clientsList, API_BASE, whatsappStatus, selectedKey, onSelectPerson, onConnectWhatsApp }) {
  const [query, setQuery] = useState('');
  const setSelectedKey = onSelectPerson;
  const [summaries, setSummaries] = useState({});

  const people = useMemo(
    () => buildPeople(clientsList).filter(p => p.phone),
    [clientsList]
  );

  // Latest-message-per-contact drives both the preview text and the sort
  // order — same as opening a real WhatsApp client, active threads float up
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch(`${API_BASE}/api/whatsapp/summary`)
        .then(r => r.json())
        .then(d => { if (!cancelled && d.success) setSummaries(d.summaries || {}); })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [API_BASE]);

  const normalizePhone = (phone) => {
    let clean = String(phone || '').replace(/\D/g, '');
    if (clean.length === 10) clean = '91' + clean;
    return clean;
  };

  const sortedPeople = useMemo(() => {
    const withPreview = people.map(p => ({ ...p, lastMessage: summaries[normalizePhone(p.phone)] || null }));
    return withPreview.sort((a, b) => {
      const at = a.lastMessage?.timestamp || 0;
      const bt = b.lastMessage?.timestamp || 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name);
    });
  }, [people, summaries]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return sortedPeople;
    return sortedPeople.filter(p => p.search.includes(q));
  }, [sortedPeople, query]);

  const selected = filtered.find(p => p.key === selectedKey) || sortedPeople.find(p => p.key === selectedKey) || null;

  const connected = whatsappStatus === 'ready';

  return (
    <div className="wa-app-shell">
      <div className="wa-app-list" style={{
        border: '1px solid var(--line-strong, #dcdce4)', borderRadius: '12px',
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid var(--line-faint, #ececef)',
          flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '26px', height: '26px', borderRadius: '7px', background: '#25D366', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <IconWhatsApp size={14} />
            </span>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#111' }}>WhatsApp</span>
            <span style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', color: 'var(--ink-faint, #8a8a99)'
            }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: connected ? '#25D366' : '#DC3545'
              }} />
              {connected ? 'Connected' : 'Not linked'}
            </span>
          </div>

          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint, #8a8a99)', display: 'flex' }}>
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search CSMs…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', border: '1px solid var(--line-strong, #dcdce4)', borderRadius: '8px',
                padding: '8px 10px 8px 30px', fontSize: '12.5px', outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 14px', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', textAlign: 'center' }}>
              No CSMs with a phone number match that search.
            </div>
          ) : (
            filtered.map(p => (
              <ContactRow key={p.key} person={p} active={p.key === selectedKey} onSelect={setSelectedKey} />
            ))
          )}
        </div>
      </div>

      <div className="wa-app-chat">
        {!connected ? (
          <div style={{
            border: '1px dashed var(--line-strong, #dcdce4)', borderRadius: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '12px', color: 'var(--ink-faint, #8a8a99)', fontSize: '13.5px', textAlign: 'center', padding: '20px', height: '100%'
          }}>
            <div>Your WhatsApp isn't linked yet.<br />Connect it to start chatting with your CSMs here.</div>
            <button
              type="button"
              onClick={onConnectWhatsApp}
              style={{
                background: '#25D366', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Connect WhatsApp
            </button>
          </div>
        ) : !selected ? (
          <div style={{
            border: '1px dashed var(--line-strong, #dcdce4)', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-faint, #8a8a99)', fontSize: '13.5px', textAlign: 'center', padding: '20px', height: '100%'
          }}>
            Pick a CSM on the left to open the chat.
          </div>
        ) : (
          <WhatsAppChatBox
            key={selected.key}
            person={selected}
            API_BASE={API_BASE}
            onRequestConnect={onConnectWhatsApp}
            fill
          />
        )}
      </div>
    </div>
  );
}
