import ContactBlock from './ContactBlock';

const KINDS = ['primary', 'secondary', 'lead', 'tier4', 'tier5'];

export default function ClientCard({ client }) {
  const c = client;

  // Every populated tier (L1 through VP), ascending seniority, blanks
  // already skipped by the backend — a client can have more than 3 filled
  // at once (Senior CSE + CSM + AVP + VP is a real, common case), so this
  // is a variable-length row, not a fixed 3 slots. Position drives the
  // color (blue/teal/amber/violet/rose), not the specific tier, so
  // whatever lands in slot 1 always reads as "the main contact" and the
  // most senior person present is always whichever box is last.
  const boxes = c.hierarchy?.length > 0
    ? c.hierarchy.map(h => ({ roleLabel: h.role, person: h }))
    : [{ roleLabel: 'Primary CSM', person: { name: 'Unassigned' } }];

  return (
    <div className={`card ${c.hierarchy?.length > 0 ? 'role-primary' : 'role-none'}`}>
      <div className="card-head">
        <div className="company">
          <span className="company-name">{c.legalName}</span>
          <span className="id-badge">ID {c.id}</span>
        </div>
        <span className="product-pill">{c.product || 'N/A'}</span>
      </div>
      <div className="contact-grid">
        {boxes.map((b, i) => (
          <ContactBlock key={i} roleLabel={b.roleLabel} person={b.person} kind={KINDS[i % KINDS.length]} />
        ))}
      </div>
    </div>
  );
}
