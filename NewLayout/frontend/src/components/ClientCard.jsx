import ContactBlock from './ContactBlock';

const KINDS = ['primary', 'secondary', 'lead'];

export default function ClientCard({ client }) {
  const c = client;

  // Primary/AVP/VP, but skip whichever ones have nobody assigned — an
  // empty Primary with AVP and VP sitting two slots to the right (needing
  // a scroll to reach) is worse than just shifting AVP into the first
  // slot. Position drives the color (blue/teal/amber), not the role, so
  // whatever lands in slot 1 always reads as "the main contact."
  const slots = [
    c.csm1?.name ? { roleLabel: c.csm1.role || 'Primary CSM', person: c.csm1 } : null,
    c.csm2?.name ? { roleLabel: 'AVP - Customer Success', person: c.csm2 } : null,
    c.lead?.name ? { roleLabel: 'VP - Customer Success', person: c.lead } : null,
  ].filter(Boolean);

  const boxes = slots.length > 0 ? slots : [{ roleLabel: 'Primary CSM', person: { name: 'Unassigned' } }];

  return (
    <div className={`card ${slots.length > 0 ? 'role-primary' : 'role-none'}`}>
      <div className="card-head">
        <div className="company">
          <span className="company-name">{c.legalName}</span>
          <span className="id-badge">ID {c.id}</span>
        </div>
        <span className="product-pill">{c.product || 'N/A'}</span>
      </div>
      <div className="contact-grid">
        {boxes.map((b, i) => (
          <ContactBlock key={i} roleLabel={b.roleLabel} person={b.person} kind={KINDS[i]} />
        ))}
      </div>
    </div>
  );
}
