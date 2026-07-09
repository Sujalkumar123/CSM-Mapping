import { useState } from 'react';
import { getInitials, getWhatsAppLink } from '../data/clients';
import { IconSend, IconMail, IconSlack, IconWhatsApp, IconInfo } from './Icons';

export default function BulkMessageCenter({ clientsList = [], roster = [] }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const filteredRoster = roster.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const allNames = roster.map(p => p.name);
  const isAllSelected = allNames.length > 0 && allNames.every(n => selected.has(n));

  const handleSelectAll = (checked) => {
    const next = new Set(selected);
    if (checked) {
      allNames.forEach(n => next.add(n));
    } else {
      allNames.forEach(n => next.delete(n));
    }
    setSelected(next);
  };

  const handleSelectRow = (name, checked) => {
    const next = new Set(selected);
    if (checked) {
      next.add(name);
    } else {
      next.delete(name);
    }
    setSelected(next);
  };

  const handleRemoveChip = (name) => {
    const next = new Set(selected);
    next.delete(name);
    setSelected(next);
  };

  const handleSend = () => {
    const activeRoster = roster.filter(p => selected.has(p.name));
    if (channel === 'email') {
      const emails = activeRoster.map(p => p.email).filter(Boolean);
      const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(emails.join(','))}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
    } else if (channel === 'slack') {
      const list = activeRoster.map(p => `${p.name} — ${p.slack || 'no slack id'}`).join('\n');
      navigator.clipboard?.writeText(`${body}\n\nRecipients:\n${list}`);
      alert('Slack broadcast list + message copied to clipboard. Paste into Slack DMs.');
    } else {
      const links = activeRoster.map(p => `${p.name}: ${getWhatsAppLink(p.phone) || 'no phone'}`).join('\n');
      navigator.clipboard?.writeText(links);
      alert('WhatsApp links for selected CSMs copied to clipboard.');
    }
  };

  const channelHints = {
    email: "Opens your email client with every selected CSM's address pre-filled in Bcc.",
    slack: "Copies a ready-to-paste Slack broadcast list with each CSM's member ID.",
    whatsapp: "Copies each selected CSM's WhatsApp link so you can message them one by one."
  };

  return (
    <section id="view-bulk">
      <div className="bulk-shell">
        {/* Recipient Picker */}
        <div className="bulk-panel">
          <div className="bulk-panel-head">
            <h3>Recipients</h3>
            <span className="nav-count" id="recipient-total-count">{roster.length}</span>
          </div>
          <div className="bulk-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Filter CSMs…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="select-all-row">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={e => handleSelectAll(e.target.checked)}
            />
            Select all CSMs
          </label>
          <div className="recipient-list">
            {filteredRoster.length === 0 ? (
              <div className="search-empty">No CSMs match "{search}"</div>
            ) : (
              filteredRoster.map(p => {
                const load = clientsList.filter(c => c.csm1?.name === p.name || c.csm2?.name === p.name).length;
                return (
                  <label key={p.name} className="recipient-row">
                    <input
                      type="checkbox"
                      checked={selected.has(p.name)}
                      onChange={e => handleSelectRow(p.name, e.target.checked)}
                    />
                    <div className="avatar-ring">
                      <div className="avatar">
                        {getInitials(p.name)}
                      </div>
                    </div>
                    <div className="rinfo">
                      <div className="rname">{p.name}</div>
                      <div className="rsub">{p.email || 'No email on file'}</div>
                    </div>
                    <span className="rload">{load}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="composer">
          <div className="recipient-chips">
            {selected.size === 0 ? (
              <span className="chip-empty">No recipients selected yet — pick CSMs from the left panel.</span>
            ) : (
              [...selected].map(n => (
                <span key={n} className="chip">
                  <span className="avatar" style={{ background: 'var(--violet)' }}>
                    {getInitials(n)}
                  </span>
                  {n}
                  <span className="chip-remove" onClick={() => handleRemoveChip(n)}>✕</span>
                </span>
              ))
            )}
          </div>

          <div className="channel-tabs">
            <button
              className={`channel-tab ${channel === 'email' ? 'active' : ''}`}
              onClick={() => setChannel('email')}
            >
              <IconMail />
              Email
            </button>
            <button
              className={`channel-tab ${channel === 'slack' ? 'active' : ''}`}
              onClick={() => setChannel('slack')}
            >
              <IconSlack />
              Slack
            </button>
            <button
              className={`channel-tab ${channel === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setChannel('whatsapp')}
            >
              <IconWhatsApp />
              WhatsApp
            </button>
          </div>

          <div className="compose-card">
            {channel === 'email' && (
              <div className="compose-field">
                <label>Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 renewal checklist — action needed"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
            )}
            <div className="compose-field">
              <label>Message</label>
              <textarea
                placeholder="Write your update once — it goes out to everyone selected on the left."
                value={body}
                onChange={e => setBody(e.target.value)}
              />
              <div className="char-count"><span>{body.length}</span> characters</div>
            </div>
            <div className="bulk-hint">
              <IconInfo />
              <span>{channelHints[channel]}</span>
            </div>
            <div className="compose-footer">
              <div className="send-summary">
                Sending to <b>{selected.size}</b> CSM{selected.size === 1 ? '' : 's'}
              </div>
              <button
                className="btn btn-violet"
                disabled={selected.size === 0}
                onClick={handleSend}
              >
                <IconSend />
                Send broadcast
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
