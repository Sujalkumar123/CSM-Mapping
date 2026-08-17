import { useState, useEffect, useRef } from 'react';
import { IconWhatsApp, IconClose } from './Icons';

// Global WhatsApp Web pairing modal — reachable from the Sidebar or from the
// Inbox panel, instead of being buried inside Bulk Message Center.
export default function WhatsAppConnectModal({ isOpen, onClose, API_BASE }) {
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      clearInterval(pollRef.current);
      return;
    }

    const check = () => {
      fetch(`${API_BASE}/api/whatsapp/status`)
        .then(res => res.json())
        .then(data => {
          setStatus(data.status);
          setQr(data.qr || '');
        })
        .catch(() => {});
    };

    check();
    pollRef.current = setInterval(check, 1200);
    return () => clearInterval(pollRef.current);
  }, [isOpen, API_BASE]);

  // Auto-close a couple seconds after the scan succeeds, so the success state is visible
  useEffect(() => {
    if (status === 'ready' && isOpen) {
      const t = setTimeout(onClose, 1800);
      return () => clearTimeout(t);
    }
  }, [status, isOpen, onClose]);

  const handleReset = async () => {
    setStatus('disconnected');
    setQr('');
    try {
      await fetch(`${API_BASE}/api/whatsapp/reset`, { method: 'POST' });
    } catch (e) {}
  };

  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head" style={{ background: 'linear-gradient(180deg, rgba(37, 211, 102, 0.1), transparent)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366' }}>
            <IconWhatsApp size={18} /> Connect WhatsApp
          </h3>
          <div className="modal-close" onClick={onClose}><IconClose /></div>
        </div>

        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', gap: '16px' }}>
          {status === 'ready' ? (
            <div style={{ padding: '30px 0', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', background: '#25D366',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
              }}>✓</div>
              <div style={{ fontWeight: 700, color: '#111' }}>WhatsApp is connected</div>
              <div style={{ fontSize: '12px', color: 'var(--ink-faint)' }}>Every CSM's chat is now live in the Inbox.</div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '13px', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.45 }}>
                Open WhatsApp on your phone → Settings → Linked Devices → Link a Device, then scan this code.
              </p>

              {qr ? (
                <div style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-strong)' }}>
                  <img src={qr} alt="Scan to link WhatsApp" style={{ width: '180px', height: '180px', display: 'block' }} />
                </div>
              ) : (
                <div style={{ padding: '30px 0', color: 'var(--ink-soft)' }}>
                  <div className="spinner" style={{
                    border: '3px solid #f3f3f3', borderTop: '3px solid #25D366', borderRadius: '50%',
                    width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 10px'
                  }} />
                  {status === 'loading' ? 'Initializing WhatsApp engine…' : 'Waiting for a QR code…'}
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: 'var(--ink-faint)' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: status === 'qr' ? '#FFC107' : '#DC3545'
                }} />
                Status: {status}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" style={{ color: '#eb5e28', fontSize: '12px' }} onClick={handleReset}>
            🔄 Reset &amp; regenerate QR
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
