import { useState, useEffect, useRef } from 'react';
import { IconWhatsApp, IconClose } from './Icons';

// Global WhatsApp Web pairing modal — reachable from the Sidebar or from the
// Inbox panel, instead of being buried inside Bulk Message Center.
export default function WhatsAppConnectModal({ isOpen, onClose, API_BASE }) {
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState('');
  const [lastError, setLastError] = useState('');
  const [waitSeconds, setWaitSeconds] = useState(0);
  const pollRef = useRef(null);
  const waitTimerRef = useRef(null);

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
          setLastError(data.lastError || '');
        })
        .catch(() => {});
    };

    check();
    pollRef.current = setInterval(check, 1200);
    return () => clearInterval(pollRef.current);
  }, [isOpen, API_BASE]);

  // Cold-starting a headless browser (Render's compute tier especially) can
  // take a couple of minutes. Without this, the spinner alone reads as
  // "broken," which pushes people to hit Reset repeatedly — and each click
  // restarts that same slow clock from zero instead of just letting it finish.
  useEffect(() => {
    if (!isOpen || qr || status === 'ready') {
      clearInterval(waitTimerRef.current);
      setWaitSeconds(0);
      return;
    }
    waitTimerRef.current = setInterval(() => setWaitSeconds(s => s + 1), 1000);
    return () => clearInterval(waitTimerRef.current);
  }, [isOpen, qr, status]);

  // Auto-close a couple seconds after the scan succeeds, so the success state is visible
  useEffect(() => {
    if (status === 'ready' && isOpen) {
      const t = setTimeout(onClose, 1800);
      return () => clearTimeout(t);
    }
  }, [status, isOpen, onClose]);

  const handleReset = async () => {
    // A QR is already showing — it's valid and waiting to be scanned. This
    // is the actual gap that kept undoing working connections: resetting
    // here throws away a functioning QR and restarts the ~2 minute cycle,
    // with zero warning that anything was even lost.
    if (qr && status === 'qr') {
      const proceed = window.confirm(
        `A QR code is already showing and ready to scan.\n\nResetting now will throw it away and restart the ~2 minute process from zero — scanning the code on screen is almost always faster. Reset anyway?`
      );
      if (!proceed) return;
    } else if (!qr && status === 'loading' && !lastError && waitSeconds < 90) {
      // Mid-cold-start with no error yet, this is very likely someone about to
      // restart a slow-but-working process out of impatience — that's the
      // exact behavior that turns a single ~2min wait into a repeating loop
      const proceed = window.confirm(
        `It's still starting up (${waitSeconds}s) with no error — this is likely just a slow cold start, not stuck.\n\nResetting now will throw away this progress and restart the ~2 minute process from zero. Reset anyway?`
      );
      if (!proceed) return;
    }
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

              <div style={{
                background: 'rgba(235, 94, 40, 0.08)', color: '#EB5E28',
                padding: '9px 12px', borderRadius: 'var(--radius-md)',
                fontSize: '11px', fontWeight: 500, lineHeight: 1.4,
                border: '1px solid rgba(235, 94, 40, 0.2)'
              }}>
                ⚠️ <b>Do NOT scan with your phone's regular camera app.</b> It must be scanned from inside WhatsApp itself — Settings → Linked Devices → Link a Device — or the scan won't reach this dashboard at all.
              </div>

              {qr ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px',
                    fontWeight: 700, color: '#1a8a4a'
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#25D366' }} />
                    Ready — scan now
                  </div>
                  <div style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', border: '2px solid #25D366' }}>
                    <img src={qr} alt="Scan to link WhatsApp" style={{ width: '180px', height: '180px', display: 'block' }} />
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px 0', color: 'var(--ink-soft)' }}>
                  <div className="spinner" style={{
                    border: '3px solid #f3f3f3', borderTop: '3px solid #25D366', borderRadius: '50%',
                    width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 10px'
                  }} />
                  {status === 'loading' ? 'Initializing WhatsApp engine…' : 'Waiting for a QR code…'}
                  {waitSeconds >= 20 && (
                    <div style={{
                      marginTop: '12px', fontSize: '11.5px', color: 'var(--ink-faint)',
                      lineHeight: 1.5, maxWidth: '260px', marginInline: 'auto'
                    }}>
                      Still starting up ({waitSeconds}s) — a first-time connect can take a couple of minutes on the server.
                      <br /><b>Clicking Reset now restarts this from zero</b> — it's usually faster to just wait.
                    </div>
                  )}
                  {lastError && (
                    <div style={{
                      marginTop: '10px', fontSize: '11px', color: '#EB5E28', background: 'rgba(235, 94, 40, 0.08)',
                      padding: '8px 10px', borderRadius: '6px', textAlign: 'left', wordBreak: 'break-word'
                    }}>
                      {lastError}
                    </div>
                  )}
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
