import { useState, useEffect, useRef } from 'react';
import { getInitials } from '../data/clients';

const AVATAR_COLORS = ['#25D366', '#7c3aed', '#0078d4', '#d83b01', '#107c41', '#e3008c'];
const getAvatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp * 1000);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function WhatsAppChatBox({ person, API_BASE }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const phone = person?.phone || '';

  const loadHistory = async () => {
    if (!phone) return;
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/chat/${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error('Chat history error:', e);
    } finally {
      setLoading(false);
    }
  };

  const pollMessages = async () => {
    if (!phone) return;
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/messages/${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (data.success && data.messages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newOnes = data.messages.filter(m => !existingIds.has(m.id));
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    loadHistory();
    pollRef.current = setInterval(pollMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !phone || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistically add to chat
    const optimistic = {
      id: 'opt-' + Date.now(),
      body: text,
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'chat'
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: text })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to deliver message');
      }
    } catch (e) {
      console.error('Send failed:', e);
      alert(`Message delivery failed: ${e.message}`);
      // Remove optimistic bubble on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  // Group messages by date
  const grouped = [];
  let lastDate = '';
  messages.forEach(msg => {
    const label = formatDateLabel(msg.timestamp);
    if (label !== lastDate) {
      grouped.push({ type: 'date', label });
      lastDate = label;
    }
    grouped.push({ type: 'msg', ...msg });
  });

  const avatarColor = getAvatarColor(person?.name);
  const initials = getInitials(person?.name || '');

  return (
    <div style={{
      border: '1px solid var(--line-strong)',
      borderRadius: '12px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '400px',
      background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 16px',
        background: '#f0f2f5',
        borderBottom: '1px solid var(--line-faint)',
        flexShrink: 0
      }}>
        <div style={{
          width: '40px', height: '40px',
          borderRadius: '50%',
          background: avatarColor,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: '700', fontSize: '15px',
          flexShrink: 0
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#111' }}>{person?.name}</div>
          <div style={{ fontSize: '11px', color: '#667781' }}>
            {person?.phone || 'No phone'}
          </div>
        </div>
      </div>

      {/* Chat area — WhatsApp wallpaper style */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        background: '#efeae2',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc8' fill-opacity='0.3'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#667781', fontSize: '13px', marginTop: '60px' }}>
            Loading chat...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#667781', fontSize: '13px', marginTop: '60px' }}>
            No messages yet. Send the first one!
          </div>
        ) : (
          grouped.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={idx} style={{
                  textAlign: 'center', margin: '8px 0',
                }}>
                  <span style={{
                    background: 'rgba(255,255,255,0.85)',
                    color: '#667781',
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '8px',
                    fontWeight: '500'
                  }}>{item.label}</span>
                </div>
              );
            }
            return (
              <div key={item.id || idx} style={{
                display: 'flex',
                justifyContent: item.fromMe ? 'flex-end' : 'flex-start',
                marginBottom: '2px'
              }}>
                <div style={{
                  maxWidth: '72%',
                  background: item.fromMe ? '#d9fdd3' : '#fff',
                  color: '#111',
                  padding: '6px 10px 4px',
                  borderRadius: item.fromMe ? '10px 0 10px 10px' : '0 10px 10px 10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  position: 'relative'
                }}>
                  <span>{item.body}</span>
                  <span style={{
                    fontSize: '10px',
                    color: '#667781',
                    marginLeft: '8px',
                    float: 'right',
                    marginTop: '2px',
                    lineHeight: '1'
                  }}>{formatTime(item.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: '#f0f2f5',
        borderTop: '1px solid var(--line-faint)',
        flexShrink: 0
      }}>
        {/* Paperclip */}
        <button
          type="button"
          style={{
            background: 'none', border: 'none',
            color: '#8696a0', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px', borderRadius: '50%', flexShrink: 0
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#111'}
          onMouseLeave={e => e.currentTarget.style.color = '#8696a0'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {/* Message input */}
        <input
          type="text"
          placeholder="Type a message"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: '20px',
            padding: '8px 14px',
            fontSize: '13px',
            background: '#fff',
            outline: 'none',
            color: '#111',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
          }}
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: '38px', height: '38px',
            borderRadius: '50%',
            background: input.trim() ? '#25D366' : '#c4c4c4',
            border: 'none',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'background 0.2s ease',
            flexShrink: 0
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
