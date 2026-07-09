import { useState, useEffect } from 'react';
import { IconClose } from './Icons';

export default function AddCsmModal({ isOpen, onClose, onSave, editingClient }) {
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
              <div className="form-field">
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Aditi Rao"
                  value={csm1Name}
                  onChange={e => setCsm1Name(e.target.value)}
                  required
                />
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
              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={emailBlank ? '' : csm1Email}
                  onChange={e => setCsm1Email(e.target.value)}
                  disabled={emailBlank}
                />
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
              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={csm2Name}
                  onChange={e => setCsm2Name(e.target.value)}
                />
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
              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={csm2Email}
                  onChange={e => setCsm2Email(e.target.value)}
                />
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
              <div className="form-field">
                <label>Name</label>
                <input
                  type="text"
                  value={leadName}
                  onChange={e => setLeadName(e.target.value)}
                />
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
              <div className="form-field">
                <label>Email</label>
                <input
                  type="email"
                  value={leadEmail}
                  onChange={e => setLeadEmail(e.target.value)}
                />
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
