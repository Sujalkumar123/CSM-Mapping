import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { getInitials } from '../data/clients';
import { buildPeople, getAvatarColor } from '../data/people';
import { IconWhatsApp, IconSlack, IconMail, IconSearch } from './Icons';

const CHANNELS = {
  whatsapp: { label: 'WhatsApp', accent: '#25D366', Icon: IconWhatsApp },
  slack: { label: 'Slack', accent: '#7c3aed', Icon: IconSlack },
  email: { label: 'Email', accent: '#0078d4', Icon: IconMail }
};
const CHANNEL_KEYS = ['whatsapp', 'slack', 'email'];

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatListDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

// Gmail-style row list — sender, subject, snippet, date — instead of chat
// bubbles, since a real inbox is what a mailbox is supposed to look like
// Full-width reader — the three-column panel is far too narrow for a real
// email, so anything longer than a couple lines gets its own roomy view.
function EmailReaderModal({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [message, onClose]);

  if (!message) return null;

  const when = message.timestamp
    ? new Date(message.timestamp * 1000).toLocaleString([], {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(3px)', zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px', width: 'min(900px, 100%)',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--line-faint, #ececef)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#111', lineHeight: 1.35 }}>
                {message.subject || '(no subject)'}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', marginTop: '6px', wordBreak: 'break-word' }}>
                <strong style={{ color: 'var(--ink-soft, #555)' }}>
                  {message.fromMe ? 'You' : (message.fromName || message.from || 'Unknown')}
                </strong>
                {message.from && !message.fromMe && <> &lt;{message.from}&gt;</>}
                {message.to?.length > 0 && <> → {message.to.join(', ')}</>}
              </div>
              {when && (
                <div style={{ fontSize: '11.5px', color: 'var(--ink-faint, #8a8a99)', marginTop: '3px' }}>{when}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px',
                lineHeight: 1, color: 'var(--ink-faint, #8a8a99)', padding: '0 4px', flexShrink: 0
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div style={{
          padding: '18px 20px', overflowY: 'auto', flex: 1, minHeight: 0,
          fontSize: '14px', lineHeight: 1.65, color: '#222',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>
          {message.body || <em style={{ opacity: 0.6 }}>(empty)</em>}
        </div>
      </div>
    </div>
  );
}

const ExpandIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const EmailList = memo(function EmailList({ messages, loading, emptyText, accent, onOpen }) {
  const [expandedId, setExpandedId] = useState(null);
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fff', minHeight: 0 }}>
      {loading ? (
        <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)' }}>Loading…</div>
      ) : newestFirst.length === 0 ? (
        <div style={{ padding: '30px 12px', textAlign: 'center', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)' }}>{emptyText}</div>
      ) : (
        newestFirst.map((m, i) => {
          const expanded = expandedId === (m.id || i);
          return (
            <div key={m.id || i} style={{ borderBottom: '1px solid var(--line-faint, #ececef)' }}>
              <div
                onClick={() => setExpandedId(expanded ? null : (m.id || i))}
                style={{
                  padding: '10px 12px', cursor: 'pointer',
                  background: expanded ? 'var(--surface-2, #f7f7f9)' : m.pending ? 'var(--surface-2, #f7f7f9)' : '#fff',
                  opacity: m.pending ? 0.65 : 1
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.fromMe ? 'You' : (m.fromName || m.from || 'Unknown')}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--ink-faint, #8a8a99)' }}>
                      {formatListDate(m.timestamp)}
                    </span>
                    {onOpen && (
                      <button
                        type="button"
                        title="Open in reader"
                        onClick={e => { e.stopPropagation(); onOpen(m); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                          display: 'flex', alignItems: 'center', color: 'var(--ink-faint, #8a8a99)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = accent}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-faint, #8a8a99)'}
                      >
                        <ExpandIcon />
                      </button>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#111', fontWeight: 600, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.subject || '(no subject)'}
                </div>
                {!expanded && (
                  <div style={{ fontSize: '11.5px', color: 'var(--ink-faint, #8a8a99)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.snippet || m.body || '(empty)'}
                  </div>
                )}
              </div>
              {expanded && (
                <div style={{ background: 'var(--surface-2, #f7f7f9)', padding: '4px 12px 12px' }}>
                  <div style={{
                    fontSize: '12.5px', lineHeight: 1.55, color: '#333',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxHeight: '220px', overflowY: 'auto'
                  }}>
                    {m.body || <em style={{ opacity: 0.6 }}>(empty)</em>}
                  </div>
                  {onOpen && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onOpen(m); }}
                      style={{
                        marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                        background: '#fff', border: '1px solid var(--line-strong, #dcdce4)',
                        borderRadius: '6px', padding: '4px 9px', fontSize: '11px',
                        fontWeight: 600, color: accent, cursor: 'pointer'
                      }}
                    >
                      <ExpandIcon /> Open in reader
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
});

const MessageList = memo(function MessageList({ messages, loading, emptyText, accent }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '10px 12px',
      background: 'var(--surface-2, #f7f7f9)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minHeight: 0
    }}>
      {loading ? (
        <div style={{ margin: 'auto', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)' }}>Loading…</div>
      ) : messages.length === 0 ? (
        <div style={{ margin: 'auto', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', textAlign: 'center', padding: '0 12px' }}>
          {emptyText}
        </div>
      ) : (
        messages.map((m, i) => (
          <div key={m.id || i} style={{ display: 'flex', justifyContent: m.fromMe ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              background: m.fromMe ? accent : '#fff',
              color: m.fromMe ? '#fff' : '#111',
              padding: '7px 10px',
              borderRadius: m.fromMe ? '10px 2px 10px 10px' : '2px 10px 10px 10px',
              fontSize: '12.5px',
              lineHeight: '1.45',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              opacity: m.pending ? 0.65 : 1
            }}>
              {m.subject && <div style={{ fontWeight: 700, marginBottom: '3px', fontSize: '12px' }}>{m.subject}</div>}
              {m.body || <em style={{ opacity: 0.6 }}>(empty)</em>}
              <div style={{ fontSize: '10px', opacity: 0.65, marginTop: '4px', textAlign: 'right' }}>
                {formatTime(m.timestamp)}
              </div>
            </div>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
});

function ChannelPanel({ channel, person, thread, loading, onAppend, onReplace, API_BASE, onConnectWhatsApp, onOpenEmail, onExpand }) {
  const { label, accent, Icon } = CHANNELS[channel];
  const [input, setInput] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(false);

  const target = channel === 'whatsapp' ? person.phone
    : channel === 'slack' ? person.slack
    : person.email;

  const messages = thread?.messages || [];

  useEffect(() => { setFullyLoaded(false); }, [person.key]);

  // Email starts capped at 40 messages for speed — pull the rest on demand
  // rather than always paying for a "complete inbox" nobody asked to see
  const handleLoadFullHistory = async () => {
    if (!target || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API_BASE}/api/email/thread/${encodeURIComponent(target)}?limit=200`);
      const data = await res.json();
      if (data.success) {
        onReplace(
          'email',
          () => data.messages.map(m => ({ ...m, timestamp: Math.floor(m.date / 1000) })),
          { matched: data.matched }
        );
        setFullyLoaded(true);
      }
    } catch (e) {
    } finally {
      setLoadingMore(false);
    }
  };

  // Seed the reply subject from the newest mail in the thread
  useEffect(() => {
    if (channel !== 'email') return;
    const last = messages[messages.length - 1];
    const s = last?.subject || '';
    setSubject(s ? (s.toLowerCase().startsWith('re:') ? s : `Re: ${s}`) : '');
  }, [channel, messages.length]);

  useEffect(() => { setInput(''); setSendError(''); }, [person.key, channel]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !target) return;

    setSending(true);
    setSendError('');

    const tempId = 'opt-' + Date.now();
    onAppend(channel, {
      id: tempId,
      body: text,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      subject: channel === 'email' ? subject : undefined,
      pending: true
    });
    setInput('');

    try {
      let url, payload;
      if (channel === 'whatsapp') {
        url = `${API_BASE}/api/whatsapp/send-single`;
        payload = { phone: target, message: text };
      } else if (channel === 'slack') {
        url = `${API_BASE}/api/slack/send-single`;
        payload = { slackId: target, message: text };
      } else {
        const lastInbound = [...messages].reverse().find(m => !m.fromMe);
        url = `${API_BASE}/api/email/send`;
        payload = { to: target, subject, body: text, inReplyTo: lastInbound?.messageId };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        onReplace(channel, prev => prev.filter(m => m.id !== tempId));
        setInput(text);
        setSendError(data.error || 'Message could not be delivered.');
      } else {
        // For WhatsApp, the backend returns the real Baileys message id/
        // timestamp — adopt it so the 5s poll below recognizes this as the
        // same message (by id) instead of appending it a second time.
        onReplace(channel, prev => prev.map(m => m.id === tempId
          ? { ...m, id: data.id || m.id, timestamp: data.timestamp || m.timestamp, pending: false }
          : m
        ));
      }
    } catch (e) {
      onReplace(channel, prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      setSendError('Message could not be delivered.');
    } finally {
      setSending(false);
    }
  };

  const unavailable = thread && thread.available === false;
  const notConfigured = thread?.error === 'NOT_CONFIGURED';
  const notConnected = thread?.error === 'NOT_CONNECTED';
  const loadError = thread?.error && !notConfigured && !notConnected ? thread.error : '';
  const canSend = !!target && !unavailable && !notConfigured && !notConnected;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--line-strong, #dcdce4)',
      borderRadius: '12px',
      overflow: 'hidden',
      background: '#fff',
      minHeight: 0,
      minWidth: 0,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 12px',
        borderBottom: '1px solid var(--line-faint, #ececef)',
        background: '#fff', flexShrink: 0
      }}>
        <span style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Icon size={13} />
        </span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#111' }}>{label}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '11px',
          color: 'var(--ink-faint, #8a8a99)',
          fontFamily: 'var(--mono, monospace)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%'
        }}>{target || '—'}</span>
        {channel === 'email' && !notConfigured && messages.length >= 40 && !fullyLoaded && (
          <button
            type="button"
            onClick={handleLoadFullHistory}
            disabled={loadingMore}
            style={{
              flexShrink: 0, background: 'none', border: '1px solid var(--line-strong, #dcdce4)',
              borderRadius: '6px', padding: '3px 8px', fontSize: '10.5px', fontWeight: 600,
              color: accent, cursor: loadingMore ? 'default' : 'pointer'
            }}
          >
            {loadingMore ? 'Loading…' : 'Load full inbox'}
          </button>
        )}
        {onExpand && (
          <button
            type="button"
            title={`Expand ${label}`}
            onClick={onExpand}
            style={{
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--ink-faint, #8a8a99)'
            }}
            onMouseEnter={e => e.currentTarget.style.color = accent}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-faint, #8a8a99)'}
          >
            <ExpandIcon size={13} />
          </button>
        )}
      </div>

      {unavailable ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', padding: '20px', textAlign: 'center' }}>
          {thread.reason}
        </div>
      ) : notConfigured ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', padding: '20px', textAlign: 'center', lineHeight: 1.5 }}>
          Gmail is not connected yet.<br />Use <strong>Connect Gmail</strong> in the sidebar.
        </div>
      ) : notConnected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', lineHeight: 1.5 }}>
            WhatsApp isn't linked to your phone yet.
          </div>
          <button
            type="button"
            onClick={onConnectWhatsApp}
            style={{
              background: '#25D366', color: '#fff', border: 'none', borderRadius: '7px',
              padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Connect WhatsApp
          </button>
        </div>
      ) : (
        <>
          {channel === 'email' && thread?.matched === false && messages.length > 0 && (
            <div style={{
              fontSize: '11px', color: 'var(--ink-soft, #666)', background: 'var(--surface-2, #f7f7f9)',
              padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid var(--line-faint, #ececef)'
            }}>
              No emails with {person.name} yet — showing your recent inbox instead.
            </div>
          )}

          {channel === 'email' ? (
            <EmailList
              messages={messages}
              loading={loading}
              emptyText="No emails yet — your inbox is empty."
              accent={accent}
              onOpen={onOpenEmail}
            />
          ) : (
            <MessageList
              messages={messages}
              loading={loading}
              emptyText={`No ${label} messages yet.`}
              accent={accent}
            />
          )}

          {(loadError || sendError) && (
            <div style={{
              fontSize: '11.5px',
              color: 'var(--rose, #f04568)',
              background: 'var(--rose-soft, #fdecef)',
              padding: '6px 12px', lineHeight: 1.4, flexShrink: 0
            }}>{sendError || loadError}</div>
          )}

          <div style={{
            borderTop: '1px solid var(--line-faint, #ececef)',
            padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px',
            background: '#fff', flexShrink: 0
          }}>
            {channel === 'email' && (
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{
                  border: '1px solid var(--line-strong, #dcdce4)',
                  borderRadius: '7px', padding: '6px 9px', fontSize: '12px', outline: 'none'
                }}
              />
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
              <textarea
                rows={channel === 'email' ? 3 : 1}
                placeholder={canSend ? `Message on ${label}…` : 'Unavailable'}
                value={input}
                disabled={!canSend}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && channel !== 'email') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                style={{
                  flex: 1,
                  border: '1px solid var(--line-strong, #dcdce4)',
                  borderRadius: '7px', padding: '7px 9px', fontSize: '12.5px',
                  resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4
                }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || sending || !canSend}
                style={{
                  background: input.trim() && !sending && canSend ? accent : '#c9c9d1',
                  color: '#fff', border: 'none', borderRadius: '7px',
                  padding: '8px 12px', fontSize: '12px', fontWeight: 600,
                  cursor: input.trim() && !sending && canSend ? 'pointer' : 'default',
                  flexShrink: 0
                }}
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Blows one channel up to full width. Hosts a real ChannelPanel rather than
// a read-only copy, so replying works exactly the same from in here.
function ChannelExpandModal({ channel, onClose, escapeEnabled = true, ...panelProps }) {
  useEffect(() => {
    // When the per-email reader is stacked on top, Escape belongs to it —
    // otherwise one keypress would dismiss both layers at once
    if (!channel || !escapeEnabled) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channel, escapeEnabled, onClose]);

  if (!channel) return null;

  const { label } = CHANNELS[channel];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(3px)', zIndex: 1150,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(900px, 100%)', height: 'min(80vh, 720px)',
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '6px',
              padding: '4px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#333'
            }}
          >
            Close {label} ✕
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ChannelPanel channel={channel} {...panelProps} />
        </div>
      </div>
    </div>
  );
}

const PersonRow = memo(function PersonRow({ person, active, onSelect }) {
  return (
    <div
      onClick={() => onSelect(person.key)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', cursor: 'pointer',
        background: active ? 'var(--violet-soft, #f2ecff)' : 'transparent',
        borderLeft: active ? '3px solid var(--violet-ink, #6d3ee0)' : '3px solid transparent'
      }}
    >
      <div style={{
        width: '34px', height: '34px', borderRadius: '50%',
        background: getAvatarColor(person.name), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12.5px', fontWeight: 700, flexShrink: 0
      }}>
        {getInitials(person.name)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-faint, #8a8a99)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {person.role} · {person.clientCount} {person.clientCount === 1 ? 'client' : 'clients'}
        </div>
      </div>
    </div>
  );
});

function normalizePhone(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) clean = '91' + clean;
  return clean;
}

// A read-only "recent activity" row — click to open the full 3-pane view
const FeedRow = memo(function FeedRow({ name, preview, previewLabel, timestamp, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '8px 10px', cursor: 'pointer', borderRadius: '8px'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2, #f7f7f9)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: getAvatarColor(name), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10.5px', fontWeight: 700, flexShrink: 0
      }}>
        {getInitials(name)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ink-faint, #8a8a99)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {previewLabel}
        </div>
      </div>
      {timestamp && (
        <span style={{ fontSize: '10px', color: 'var(--ink-faint, #8a8a99)', flexShrink: 0 }}>{formatTime(timestamp)}</span>
      )}
    </div>
  );
});

function FeedPanel({ title, accent, Icon, children, empty, flush = false }) {
  return (
    <div style={{
      border: '1px solid var(--line-strong, #dcdce4)', borderRadius: '12px',
      background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
        borderBottom: '1px solid var(--line-faint, #ececef)', flexShrink: 0
      }}>
        <span style={{
          width: '22px', height: '22px', borderRadius: '6px', background: accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Icon size={12} />
        </span>
        <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#111' }}>{title}</span>
      </div>
      {empty ? (
        <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: '12px', color: 'var(--ink-faint, #8a8a99)' }}>
          {empty}
        </div>
      ) : flush ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '4px' }}>{children}</div>
      )}
    </div>
  );
}

// The Inbox landing screen — recent CSM activity across all three channels
// at once, so you don't have to click into 80 people to see what's new.
function OverviewFeeds({ people, API_BASE, onSelect, onOpenEmail }) {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch(`${API_BASE}/api/inbox/overview`)
        .then(r => r.json())
        .then(d => { if (!cancelled && d.success) setOverview(d); })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [API_BASE]);

  const byPhone = useMemo(() => new Map(people.filter(p => p.phone).map(p => [normalizePhone(p.phone), p])), [people]);
  const bySlack = useMemo(() => new Map(people.filter(p => p.slack).map(p => [p.slack, p])), [people]);

  const waFeed = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.whatsapp)
      .map(([phone, msg]) => ({ person: byPhone.get(phone), msg }))
      .filter(r => r.person)
      .sort((a, b) => b.msg.timestamp - a.msg.timestamp);
  }, [overview, byPhone]);

  const slackFeed = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.slack)
      .map(([slackId, msg]) => ({ person: bySlack.get(slackId), msg }))
      .filter(r => r.person)
      .sort((a, b) => b.msg.timestamp - a.msg.timestamp);
  }, [overview, bySlack]);

  const emailFeed = useMemo(() => {
    if (!overview) return [];
    return overview.email.map(m => ({ ...m, timestamp: Math.floor(m.date / 1000) }));
  }, [overview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
      <div style={{
        padding: '11px 14px', border: '1px solid var(--line-strong, #dcdce4)', borderRadius: '12px',
        background: '#fff', fontSize: '13px', color: 'var(--ink-soft, #555)', flexShrink: 0
      }}>
        Recent activity across your CSM roster — pick anyone on the left to open the full conversation.
      </div>

      <div className="inbox-panels">
        <FeedPanel title="WhatsApp" accent="#25D366" Icon={IconWhatsApp} empty={overview && waFeed.length === 0 ? 'No dashboard WhatsApp chats yet.' : null}>
          {!overview ? null : waFeed.map(r => (
            <FeedRow
              key={r.person.key}
              name={r.person.name}
              previewLabel={`${r.msg.fromMe ? 'You: ' : ''}${r.msg.body || '(media)'}`}
              timestamp={r.msg.timestamp}
              onClick={() => onSelect(r.person.key)}
            />
          ))}
        </FeedPanel>

        <FeedPanel title="Slack" accent="#7c3aed" Icon={IconSlack} empty={overview && slackFeed.length === 0 ? 'No dashboard Slack chats yet.' : null}>
          {!overview ? null : slackFeed.map(r => (
            <FeedRow
              key={r.person.key}
              name={r.person.name}
              previewLabel={`${r.msg.fromMe ? 'You: ' : ''}${r.msg.body || '(empty)'}`}
              timestamp={r.msg.timestamp}
              onClick={() => onSelect(r.person.key)}
            />
          ))}
        </FeedPanel>

        <FeedPanel title="Email" accent="#0078d4" Icon={IconMail} flush empty={overview && emailFeed.length === 0 ? 'No CSM emails found.' : null}>
          {!overview ? null : (
            <EmailList
              messages={emailFeed}
              loading={false}
              emptyText="No CSM emails found."
              accent="#0078d4"
              onOpen={onOpenEmail}
            />
          )}
        </FeedPanel>
      </div>
    </div>
  );
}

export default function UnifiedInbox({ clientsList, API_BASE, selectedKey, onSelectPerson, onConnectWhatsApp }) {
  const [query, setQuery] = useState('');
  const [deferredQuery, setDeferredQuery] = useState('');
  const setSelectedKey = onSelectPerson;
  const [threads, setThreads] = useState(null);
  const [readerMail, setReaderMail] = useState(null);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [loading, setLoading] = useState(false);

  // Derived once per data change instead of once per render
  const people = useMemo(() => buildPeople(clientsList), [clientsList]);

  // Keystrokes update the input immediately; filtering trails behind it
  useEffect(() => {
    const t = setTimeout(() => setDeferredQuery(query), 120);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();
    if (!q) return people;
    return people.filter(p => p.search.includes(q));
  }, [people, deferredQuery]);

  const selected = useMemo(
    () => people.find(p => p.key === selectedKey) || null,
    [people, selectedKey]
  );

  // Every channel in one request, so a slow mailbox never delays Slack/WhatsApp
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    setLoading(true);
    setThreads(null);

    const params = new URLSearchParams();
    if (selected.phone) params.set('phone', selected.phone);
    if (selected.slack) params.set('slackId', selected.slack);
    if (selected.email) params.set('email', selected.email);

    fetch(`${API_BASE}/api/inbox?${params}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setThreads({
          whatsapp: d.whatsapp,
          slack: d.slack,
          email: {
            ...d.email,
            messages: (d.email?.messages || []).map(m => ({ ...m, timestamp: Math.floor(m.date / 1000) }))
          }
        });
      })
      .catch(() => {
        if (!cancelled) setThreads(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selected, API_BASE]);

  // WhatsApp is the only channel that pushes inbound messages at us
  useEffect(() => {
    if (!selected?.phone) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/messages/${encodeURIComponent(selected.phone)}`);
        const data = await res.json();
        if (!data.success || data.messages.length === 0) return;
        setThreads(prev => {
          if (!prev) return prev;
          const seen = new Set((prev.whatsapp?.messages || []).map(m => m.id));
          const fresh = data.messages.filter(m => !seen.has(m.id));
          if (fresh.length === 0) return prev;
          return {
            ...prev,
            whatsapp: { ...prev.whatsapp, messages: [...(prev.whatsapp?.messages || []), ...fresh] }
          };
        });
      } catch (e) {}
    }, 5000);
    return () => clearInterval(timer);
  }, [selected, API_BASE]);

  const replaceThread = useCallback((channel, updater, meta) => {
    setThreads(prev => prev && ({
      ...prev,
      [channel]: { ...prev[channel], messages: updater(prev[channel]?.messages || []), ...meta }
    }));
  }, []);

  const appendThread = useCallback((channel, msg) => {
    replaceThread(channel, prev => [...prev, msg]);
  }, [replaceThread]);

  return (
    <div className="inbox-shell">
      <div className="inbox-people" style={{
        border: '1px solid var(--line-strong, #dcdce4)',
        borderRadius: '12px', background: '#fff',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0
      }}>
        <div style={{ padding: '10px', borderBottom: '1px solid var(--line-faint, #ececef)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint, #8a8a99)', display: 'flex' }}>
              <IconSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search people…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid var(--line-strong, #dcdce4)',
                borderRadius: '8px', padding: '8px 10px 8px 30px',
                fontSize: '12.5px', outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 14px', fontSize: '12.5px', color: 'var(--ink-faint, #8a8a99)', textAlign: 'center' }}>
              No people match that search.
            </div>
          ) : (
            filtered.map(p => (
              <PersonRow
                key={p.key}
                person={p}
                active={p.key === selectedKey}
                onSelect={setSelectedKey}
              />
            ))
          )}
        </div>
      </div>

      {!selected ? (
        <OverviewFeeds people={people} API_BASE={API_BASE} onSelect={setSelectedKey} onOpenEmail={setReaderMail} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 14px',
            border: '1px solid var(--line-strong, #dcdce4)',
            borderRadius: '12px', background: '#fff', flexShrink: 0
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: getAvatarColor(selected.name), color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, flexShrink: 0
            }}>
              {getInitials(selected.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111' }}>{selected.name}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-faint, #8a8a99)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.role} · {selected.companies.join(', ')}
              </div>
            </div>
          </div>

          <div className="inbox-panels">
            {CHANNEL_KEYS.map(ch => (
              <ChannelPanel
                key={ch}
                channel={ch}
                person={selected}
                thread={threads?.[ch]}
                loading={loading}
                onAppend={appendThread}
                onReplace={replaceThread}
                API_BASE={API_BASE}
                onConnectWhatsApp={onConnectWhatsApp}
                onOpenEmail={setReaderMail}
                onExpand={() => setExpandedChannel(ch)}
              />
            ))}
          </div>
        </div>
      )}

      {selected && (
        <ChannelExpandModal
          channel={expandedChannel}
          onClose={() => setExpandedChannel(null)}
          escapeEnabled={!readerMail}
          person={selected}
          thread={threads?.[expandedChannel]}
          loading={loading}
          onAppend={appendThread}
          onReplace={replaceThread}
          API_BASE={API_BASE}
          onConnectWhatsApp={onConnectWhatsApp}
          onOpenEmail={setReaderMail}
        />
      )}

      <EmailReaderModal message={readerMail} onClose={() => setReaderMail(null)} />
    </div>
  );
}
