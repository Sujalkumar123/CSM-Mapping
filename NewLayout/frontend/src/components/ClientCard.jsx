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

  // Exactly 3 visible at a time, no matter how wide the screen is — a
  // width-based "however many fit at a comfortable size" rule (what this
  // used to be) meant a wide monitor showed all 5 tiers on one client at
  // once, which defeats the point: scrolling right is supposed to mean
  // "ask the next, more senior person," and that only reads correctly if
  // the row is always paced 3 at a time. Sizing 4+ boxes as if there were
  // only 3 is what forces the extra ones into a scroll regardless of
  // available width; 1-2 boxes still divide the full width between them.
  const visibleCount = Math.min(boxes.length, 3);
  const gap = 12;
  const boxStyle = { flex: `0 0 calc((100% - ${(visibleCount - 1) * gap}px) / ${visibleCount})` };

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
          <ContactBlock key={i} roleLabel={b.roleLabel} person={b.person} kind={KINDS[i % KINDS.length]} style={boxStyle} />
        ))}
      </div>
    </div>
  );
}
