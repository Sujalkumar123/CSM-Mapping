import { IconClose } from './Icons';

export default function AddCsmModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Add new CSM assignment</h3>
          <div className="modal-close" onClick={onClose}>
            <IconClose />
          </div>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <div className="section-title">Account</div>
            <div className="form-row single">
              <div className="form-field">
                <label>Company (legal name) *</label>
                <input type="text" placeholder="e.g. Acme Corp" />
              </div>
            </div>
            <div className="form-row single">
              <div className="form-field">
                <label>Product</label>
                <input type="text" placeholder="e.g. Retail Suite" />
              </div>
            </div>
          </div>
          <div className="form-section">
            <div className="section-title">Primary CSM</div>
            <div className="form-row">
              <div className="form-field">
                <label>Name *</label>
                <input type="text" placeholder="e.g. Aditi Rao" />
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input type="text" placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="phone-blank-cb" />
              <label htmlFor="phone-blank-cb">Mark phone as blank</label>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Email</label>
                <input type="email" placeholder="name@company.com" />
              </div>
              <div className="form-field">
                <label>Slack member ID</label>
                <input type="text" placeholder="U05AB12CD" />
              </div>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="email-blank-cb" />
              <label htmlFor="email-blank-cb">Mark email as blank</label>
            </div>
          </div>
          <div className="form-section">
            <div className="section-title">Secondary CSM (optional)</div>
            <div className="form-row">
              <div className="form-field">
                <label>Name</label>
                <input type="text" />
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input type="text" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Email</label>
                <input type="email" />
              </div>
              <div className="form-field">
                <label>Slack member ID</label>
                <input type="text" />
              </div>
            </div>
          </div>
          <div className="form-section">
            <div className="section-title">Account lead (optional)</div>
            <div className="form-row">
              <div className="form-field">
                <label>Name</label>
                <input type="text" />
              </div>
              <div className="form-field">
                <label>Phone</label>
                <input type="text" />
              </div>
            </div>
            <div className="form-row single">
              <div className="form-field">
                <label>Email</label>
                <input type="email" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={onClose}>Save CSM</button>
          </div>
        </div>
      </div>
    </div>
  );
}
