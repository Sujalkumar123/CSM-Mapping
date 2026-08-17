const AVATAR_COLORS = ['#25D366', '#7c3aed', '#0078d4', '#d83b01', '#107c41', '#e3008c'];
export const getAvatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

// Collapse the roster + account leads into one de-duplicated people list.
// Runs over every client row, so it should be memoised against clientsList
// by the caller rather than recomputed per render.
export function buildPeople(clientsList) {
  const byKey = new Map();

  for (const c of clientsList) {
    const slots = [c.csm1, c.csm2, c.lead];
    for (let i = 0; i < 3; i++) {
      const p = slots[i];
      if (!p || !p.name || p.name === 'Unassigned') continue;

      const key = (p.email || p.phone || p.name).toLowerCase().trim();
      const existing = byKey.get(key);

      if (existing) {
        if (!existing.email && p.email) existing.email = p.email;
        if (!existing.phone && p.phone) existing.phone = p.phone;
        if (!existing.slack && p.slack) existing.slack = p.slack;
        if (existing.companies.length < 60 && !existing.companies.includes(c.legalName)) {
          existing.companies.push(c.legalName);
        }
        existing.clientCount++;
      } else {
        byKey.set(key, {
          key,
          name: p.name,
          email: p.email || '',
          phone: p.phone || '',
          slack: p.slack || '',
          role: i === 2 ? 'Account lead' : 'CSM',
          companies: [c.legalName],
          clientCount: 1,
          search: `${p.name} ${p.email || ''}`.toLowerCase()
        });
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
