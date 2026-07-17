import { useState, useEffect } from 'react';
import { IconClose, IconSlack, IconInfo } from './Icons';

export default function SlackSyncModal({ isOpen, onClose, onSyncComplete, API_BASE }) {
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState({ configured: false, valid: false });
  const [syncResult, setSyncResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch status on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setSyncResult(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  const fetchStatus = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/slack/status`)
      .then(res => res.json())
      .then(data => {
        setStatus(data);
        if (data.configured) {
          setTokenInput('••••••••••••••••••••••••••••••••••••');
        } else {
          setTokenInput('');
        }
      })
      .catch(err => {
        console.error("Error fetching Slack status:", err);
        setErrorMsg("Failed to connect to backend server.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleSaveConfig = (e) => {
    e.preventDefault();
    if (!tokenInput.trim() || tokenInput.startsWith('•••')) {
      setErrorMsg("Please enter a valid new token.");
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSyncResult(null);

    fetch(`${API_BASE}/api/slack/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.trim() })
    })
      .then(async res => {
        const data = await res.json();
        if (res.ok) {
          setStatus({
            configured: true,
            valid: true,
            team: data.team,
            user: data.user,
            team_id: data.team_id,
            user_id: data.user_id
          });
          setTokenInput('••••••••••••••••••••••••••••••••••••');
          alert("Slack token configured successfully!");
        } else {
          setErrorMsg(data.error || "Failed to validate Slack token.");
        }
      })
      .catch(err => {
        console.error("Error configuring Slack:", err);
        setErrorMsg("Network error updating Slack configuration.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleSyncNow = () => {
    setIsSyncing(true);
    setErrorMsg('');
    setSyncResult(null);

    fetch(`${API_BASE}/api/slack/sync`, { method: 'POST' })
      .then(async res => {
        const data = await res.json();
        if (res.ok) {
          setSyncResult({
            success: true,
            updatedCount: data.updatedCount,
            totalSlackUsers: data.totalSlackUsers,
            isFallback: data.isFallback
          });
          if (onSyncComplete && data.data) {
            onSyncComplete(data.data);
          }
        } else {
          setErrorMsg(data.error || "Failed to sync Slack IDs.");
        }
      })
      .catch(err => {
        console.error("Error syncing Slack:", err);
        setErrorMsg("Network error running Slack sync.");
      })
      .finally(() => {
        setIsSyncing(false);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-head" style={{ background: 'linear-gradient(180deg, var(--violet-soft), var(--surface))' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--violet-ink)' }}>
            <IconSlack size={18} stroke="var(--violet-ink)" strokeWidth="2.5" />
            Slack Sync Integration
          </h3>
          <div className="modal-close" onClick={onClose}>
            <IconClose />
          </div>
        </div>

        <div className="modal-body" style={{ gap: '20px' }}>
          {/* Connection Status Section */}
          <div className="form-section">
            <div className="section-title">Integration Status</div>
            
            {loading ? (
              <div style={{ color: 'var(--ink-soft)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="nav-count pulse" style={{ background: 'var(--violet-soft)', color: 'var(--violet-ink)' }}></span>
                Checking Connection...
              </div>
            ) : status.configured && status.valid ? (
              <div style={{
                background: 'var(--green-soft)',
                border: '1px solid var(--green)',
                color: '#1a5f3e',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                lineHeight: '1.45'
              }}>
                <strong>Connected &amp; Ready</strong>
                <div style={{ marginTop: '4px', opacity: 0.85, fontFamily: 'var(--mono)' }}>
                  Workspace: {status.team} ({status.team_id})<br />
                  Connected As: {status.user} ({status.user_id})
                </div>
              </div>
            ) : status.configured ? (
              <div style={{
                background: 'var(--rose-soft)',
                border: '1px solid var(--rose)',
                color: 'var(--rose)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                lineHeight: '1.45'
              }}>
                <strong>⚠️ Invalid Token Status</strong>
                <p style={{ marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>
                  The token is configured, but the Slack API rejected it ({status.error || 'invalid_auth'}). Please check your credentials.
                </p>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line-strong)',
                color: 'var(--ink-soft)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                lineHeight: '1.45'
              }}>
                <strong>Not Configured</strong>
                <p style={{ marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>
                  No Slack API key has been configured. Configure a token below to sync user accounts.
                </p>
              </div>
            )}
          </div>

          {/* Token Configuration Section */}
          <div className="form-section">
            <div className="section-title">Configure Access Token</div>
            <form onSubmit={handleSaveConfig} className="form-field" style={{ gap: '8px' }}>
              <label>Slack User OAuth Token</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="xoxp-... or xoxe.xoxp-..."
                  className="mono"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  style={{
                    flex: 1,
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
                  style={{
                    background: 'var(--violet-ink)',
                    color: '#fff',
                    padding: '0 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? 'Verifying...' : 'Save'}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--ink-faint)', lineHeight: '1.4' }}>
                Requires scopes: <code>users:read</code> and <code>users:read.email</code>.
              </p>
            </form>
          </div>

          {/* Sync Trigger Section */}
          <div className="form-section" style={{ borderTop: '1px solid var(--line)', paddingTop: '15px' }}>
            <div className="section-title">Sync Member Mappings</div>
            
            <div className="bulk-hint" style={{
              background: status.configured && status.valid ? 'var(--violet-soft)' : 'var(--cobalt-soft)',
              color: status.configured && status.valid ? 'var(--violet-ink)' : 'var(--cobalt-ink)',
              border: 'none',
              marginBottom: '12px'
            }}>
              <IconInfo size={14} style={{ color: status.configured && status.valid ? 'var(--violet-ink)' : 'var(--cobalt-ink)' }} />
              <span>
                {status.configured && status.valid 
                  ? "Matches Slack member profiles using the live API against your CSM roster by email address (primary) and normalized name (fallback)."
                  : "Matches Slack member profiles using your local 'slack_members.csv' file. Ideal while your workspace install is pending admin approval."}
              </span>
            </div>

            {syncResult && (
              <div style={{
                background: syncResult.isFallback ? 'var(--amber-soft)' : 'var(--cobalt-soft)',
                border: `1px solid ${syncResult.isFallback ? 'var(--amber)' : 'var(--cobalt)'}`,
                color: syncResult.isFallback ? '#8a5a00' : 'var(--cobalt-ink)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13.5px',
                marginBottom: '12px'
              }}>
                <strong>{syncResult.isFallback ? '⚠️ Synced from Local CSV Fallback' : '✅ Sync Success!'}</strong>
                <p style={{ marginTop: '4px', fontSize: '12.5px' }}>
                  {syncResult.isFallback && (
                    <>Slack API was unavailable or authorization is pending. Used <code>slack_members.csv</code>.<br /></>
                  )}
                  Scanned <strong>{syncResult.totalSlackUsers}</strong> members.<br />
                  Updated <strong>{syncResult.updatedCount}</strong> CSM assignments with Slack Member IDs.
                </p>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSyncNow}
              style={{
                background: status.configured && status.valid ? 'var(--violet)' : 'var(--cobalt)',
                color: '#fff',
                border: 'none',
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: status.configured && status.valid ? '0 4px 12px var(--violet-glow)' : '0 4px 12px var(--cobalt-glow)'
              }}
              disabled={isSyncing}
            >
              <IconSlack size={15} />
              {isSyncing 
                ? 'Syncing Slack Directory...' 
                : (status.configured && status.valid ? 'Sync Slack Member IDs Now' : 'Sync from slack_members.csv (Local Fallback)')}
            </button>
          </div>

          {errorMsg && (
            <div style={{
              color: 'var(--rose)',
              fontSize: '12.5px',
              fontWeight: '500',
              marginTop: '5px',
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
