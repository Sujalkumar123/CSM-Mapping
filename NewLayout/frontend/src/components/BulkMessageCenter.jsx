import { useState, useEffect } from 'react';
import { getInitials } from '../data/clients';
import { IconSend, IconMail, IconSlack, IconWhatsApp, IconInfo, IconClose } from './Icons';

export default function BulkMessageCenter({ clientsList = [], roster = [], API_BASE }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // WhatsApp background states
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');
  const [whatsappQr, setWhatsappQr] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  const filteredRoster = roster.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const allNames = roster.map(p => p.name);
  const isAllSelected = allNames.length > 0 && allNames.every(n => selected.has(n));

  // Poll WhatsApp status when channel is whatsapp or QR modal is active
  useEffect(() => {
    let timer;
    if (channel === 'whatsapp' || showQrModal) {
      const check = () => {
        fetch(`${API_BASE}/api/whatsapp/status`)
          .then(res => res.json())
          .then(data => {
            setWhatsappStatus(data.status);
            setWhatsappQr(data.qr);
            if (data.status === 'ready' && showQrModal) {
              setShowQrModal(false);
              alert("WhatsApp integrated successfully! Ready to send direct background messages.");
            }
          })
          .catch(err => console.error("Error checking WhatsApp status:", err));
      };
      
      check();
      timer = setInterval(check, 3000);
    }
    return () => clearInterval(timer);
  }, [channel, showQrModal, API_BASE]);

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

  const fallbackSlackCopy = (activeRoster) => {
    const list = activeRoster.map(p => `${p.name} — ${p.slack || 'no slack id'}`).join('\n');
    navigator.clipboard?.writeText(`${body}\n\nRecipients:\n${list}`);
    alert('Slack integration not active. Broadcast list + message copied to clipboard. Paste into Slack DMs.');
  };

  const handleSend = () => {
    const activeRoster = roster.filter(p => selected.has(p.name));
    if (activeRoster.length === 0) {
      alert("Please select at least one recipient first.");
      return;
    }

    if (channel === 'email') {
      const emails = activeRoster.map(p => p.email).filter(Boolean);
      const mailtoUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(emails.join(','))}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
    } else if (channel === 'slack') {
      setIsSending(true);
      fetch(`${API_BASE}/api/slack/status`)
        .then(res => res.json())
        .then(status => {
          if (status.configured && status.valid) {
            const recipients = activeRoster
              .map(p => ({ slackId: p.slack, name: p.name }))
              .filter(r => r.slackId);
            
            if (recipients.length === 0) {
              alert("None of the selected CSMs have Slack Member IDs mapped. Fallback: copying list to clipboard.");
              fallbackSlackCopy(activeRoster);
              setIsSending(false);
              return;
            }

            fetch(`${API_BASE}/api/slack/send-dm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipients, message: body })
            })
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  const sent = data.results.filter(r => r.success).length;
                  const failed = data.results.filter(r => !r.success);
                  
                  if (failed.length > 0) {
                    const failList = failed.map(f => `${f.name} (${f.error})`).join('\n');
                    alert(`Sent Slack DMs to ${sent} CSMs. Failed for:\n${failList}`);
                  } else {
                    alert(`Successfully sent Slack DMs to all ${sent} selected CSMs!`);
                  }
                } else {
                  alert(`Failed to send DMs: ${data.error || 'Unknown error'}`);
                }
              })
              .catch(err => {
                console.error("Error sending Slack DMs:", err);
                alert("Error sending DMs via server. Fallback: copying list to clipboard.");
                fallbackSlackCopy(activeRoster);
              })
              .finally(() => setIsSending(false));
          } else {
            fallbackSlackCopy(activeRoster);
            setIsSending(false);
          }
        })
        .catch(err => {
          console.error("Error checking Slack status:", err);
          fallbackSlackCopy(activeRoster);
          setIsSending(false);
        });
    } else {
      const targets = activeRoster.filter(p => p.phone);
      if (targets.length === 0) {
        alert("None of the selected CSMs have a phone number.");
        return;
      }
      
      setIsSending(true);
      fetch(`${API_BASE}/api/whatsapp/status`)
        .then(res => res.json())
        .then(data => {
          if (data.status !== 'ready') {
            setWhatsappStatus(data.status);
            setWhatsappQr(data.qr);
            setShowQrModal(true);
            setIsSending(false);
            return;
          }

          const recipients = targets.map(p => ({ phone: p.phone, name: p.name }));
          
          fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipients, message: body })
          })
            .then(res => res.json())
            .then(sendData => {
              if (sendData.success) {
                const sent = sendData.results.filter(r => r.success).length;
                const failed = sendData.results.filter(r => !r.success);
                
                if (failed.length > 0) {
                  const failList = failed.map(f => `${f.name}: ${f.error}`).join('\n');
                  alert(`Sent WhatsApp messages to ${sent} CSMs.\n\nFailed for:\n${failList}`);
                } else {
                  alert(`Successfully sent WhatsApp messages to all ${sent} selected CSMs!`);
                }
              } else {
                alert(`Failed to send WhatsApp messages: ${sendData.error || 'Unknown error'}`);
              }
            })
            .catch(err => {
              console.error("Error sending WhatsApp background messages:", err);
              alert("Network error sending WhatsApp messages.");
            })
            .finally(() => setIsSending(false));
        })
        .catch(err => {
          console.error("Error checking WhatsApp status before sending:", err);
          alert("Could not connect to backend to check WhatsApp status.");
          setIsSending(false);
        });
    }
  };

  const channelHints = {
    email: "Opens your email client with every selected CSM's address pre-filled in Bcc.",
    slack: "Sends direct messages automatically via Slack API (or copies broadcast text if inactive).",
    whatsapp: "Sends messages directly in the background (opens a QR code scan popup if not integrated)."
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
                disabled={selected.size === 0 || isSending}
                onClick={handleSend}
              >
                <IconSend />
                {isSending ? 'Sending...' : 'Send broadcast'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp QR Modal */}
      {showQrModal && (
        <div className="overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowQrModal(false)}>
          <div className="modal" style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--line-strong)',
            boxShadow: 'var(--shadow-lg)',
            width: '100%',
            maxWidth: '400px',
            overflow: 'hidden'
          }} onClick={e => e.stopPropagation()}>
            <div className="modal-head" style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--line-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(37, 211, 102, 0.08), transparent)'
            }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366', margin: 0, fontSize: '16px' }}>
                <IconWhatsApp size={18} />
                Link WhatsApp Web
              </h3>
              <div className="modal-close" style={{ cursor: 'pointer', color: 'var(--ink-faint)' }} onClick={() => setShowQrModal(false)}>
                <IconClose size={16} />
              </div>
            </div>
            <div className="modal-body" style={{
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0, lineHeight: '1.45' }}>
                Open WhatsApp on your phone, go to Linked Devices, and scan this QR code to authenticate.
              </p>
              
              {whatsappStatus === 'loading' ? (
                <div style={{ padding: '40px 0', color: 'var(--ink-soft)' }}>
                  <div className="spinner" style={{ border: '3px solid #f3f3f3', borderTop: '3px solid #25D366', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }}></div>
                  Logging in...
                </div>
              ) : whatsappQr ? (
                <div style={{
                  background: '#fff',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
                  border: '1px solid var(--line-strong)'
                }}>
                  <img src={whatsappQr} alt="Scan QR Code" style={{ width: '180px', height: '180px', display: 'block' }} />
                </div>
              ) : (
                <div style={{ padding: '40px 0', color: 'var(--ink-faint)', fontSize: '13px' }}>
                  Generating QR code, please wait...
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-faint)' }}>
                <span className="badge" style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: whatsappStatus === 'ready' ? '#25D366' : whatsappStatus === 'qr' ? '#FFC107' : '#DC3545'
                }}></span>
                <span>Status: {whatsappStatus}</span>
              </div>
            </div>
            <div className="modal-footer" style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--line-strong)',
              background: 'var(--surface-under)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px'
            }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowQrModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
