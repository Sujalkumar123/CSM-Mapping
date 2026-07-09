import ContactBlock from './ContactBlock';

export default function ClientCard({ client }) {
  const c = client;
  return (
    <div className={`card ${c.csm1?.name ? 'role-primary' : 'role-none'}`}>
      <div className="card-head">
        <div className="company">
          <span className="company-name">{c.legalName}</span>
          <span className="id-badge">ID {c.id}</span>
        </div>
        <span className="product-pill">{c.product || 'N/A'}</span>
      </div>
      <div className="contact-grid">
        <ContactBlock
          roleLabel="Primary CSM"
          person={c.csm1?.name ? c.csm1 : { name: 'Unassigned' }}
          kind="primary"
        />
        <ContactBlock roleLabel="Secondary CSM" person={c.csm2} kind="secondary" />
        <ContactBlock roleLabel="Account lead" person={c.lead} kind="lead" />
      </div>
    </div>
  );
}
