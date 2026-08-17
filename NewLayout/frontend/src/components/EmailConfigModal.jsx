import { useState, useEffect } from 'react';
import { IconClose, IconMail, IconInfo } from './Icons';

export default function EmailConfigModal({ isOpen, onClose, API_BASE }) {
  const [user, setUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [status, setStatus] = useState({ configured: false });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setAppPassword('');
    fetch(`${API_BASE}/api/email/status`)
      .then(r => r.json())
      .then(d => {
        setStatus(d);
        if (d.user) setUser(d.user);
      })
      .catch(() => setErrorMsg('Failed to connect to backend server.'));
  }, [isOpen, API_BASE]);

  const handleSave = (e) => {
    e.preventDefault();
    if (!user.trim() || !appPassword.trim()) {
      setErrorMsg('Enter both your Gmail address and a 16-character app password.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    fetch(`${API_BASE}/api/email/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user.trim(), appPassword: appPassword.trim() })
    })
      .then(async res => {
        const data = await res.json();
        if (res.ok) {
          setStatus({ configured: true, user: data.user });
          setAppPassword('');
          alert('Gmail connected successfully!');
        } else {
          setErrorMsg(data.error || 'Could not connect to Gmail.');
        }
      })
      .catch(() => setErrorMsg('Network error while saving Gmail configuration.'))
      .finally(() => setSaving(false));
  };

  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-head" style={{ background: 'linear-gradient(180deg, var(--cobalt-soft), var(--surface))' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cobalt-ink)' }}>
            <IconMail size={18} stroke="var(--cobalt-ink)" strokeWidth="2.5" />
            Connect Gmail
          </h3>
          <div className="modal-close" onClick={onClose}>
            <IconClose />
          </div>
        </div>

        <div className="modal-body" style={{ gap: '20px' }}>
          <div className="form-section">
            <div className="section-title">Connection Status</div>
            {status.configured ? (
              <div style={{
                background: 'var(--green-soft)',
                border: '1px solid var(--green)',
                color: '#1a5f3e',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px'
              }}>
                <strong>Connected</strong>
                <div style={{ marginTop: '4px', opacity: 0.85, fontFamily: 'var(--mono)' }}>
                  {status.user}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line-strong)',
                color: 'var(--ink-soft)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px'
              }}>
                <strong>Not Connected</strong>
                <p style={{ marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>
                  Connect your Gmail account to read and reply to mail from the Inbox view.
                </p>
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="section-title">Gmail Credentials</div>

            <div className="bulk-hint" style={{ background: 'var(--cobalt-soft)', color: 'var(--cobalt-ink)', border: 'none', marginBottom: '12px' }}>
              <IconInfo size={14} style={{ color: 'var(--cobalt-ink)' }} />
              <span>
                This needs a Google <strong>App Password</strong>, not your normal login password.
                Turn on 2-Step Verification, then generate one under Google Account → Security → App passwords.
              </span>
            </div>

            <form onSubmit={handleSave} className="form-field" style={{ gap: '10px' }}>
              <label>Gmail address</label>
              <input
                type="email"
                placeholder="you@gmail.com"
                value={user}
                onChange={e => setUser(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line-strong)',
                  fontSize: '13px',
                  background: 'var(--surface)',
                  outline: 'none'
                }}
              />

              <label>App password</label>
              <input
                type="password"
                className="mono"
                placeholder="16-character app password"
                value={appPassword}
                onChange={e => setAppPassword(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line-strong)',
                  fontSize: '13px',
                  background: 'var(--surface)',
                  outline: 'none'
                }}
              />

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{
                  background: 'var(--cobalt)',
                  color: '#fff',
                  border: 'none',
                  width: '100%',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                {saving ? 'Verifying with Gmail…' : status.configured ? 'Update Credentials' : 'Connect Gmail'}
              </button>
            </form>
          </div>

          {errorMsg && (
            <div style={{
              color: 'var(--rose)',
              fontSize: '12.5px',
              fontWeight: '500',
              background: 'var(--rose-soft)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(240,69,104,0.15)'
            }}>
              {errorMsg}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
