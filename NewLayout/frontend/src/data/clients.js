/* ============================================================
   Dummy data — swap for real API-backed dataset.
   Field names mirror data_loader.py columns 1:1.
   ============================================================ */
export const CLIENTS = [
  {id:"1041", legalName:"Orbit Retail Pvt Ltd", product:"Retail Suite",
    csm1:{name:"Aditi Rao", email:"aditi.rao@company.com", phone:"9876543210", slack:"U05AB12CD"},
    csm2:{name:"Karan Mehta", email:"karan.mehta@company.com", phone:"", slack:"U05XY34YZ"},
    lead:{name:"Sana Vij", email:"sana.vij@company.com", phone:"9123456780"}},
  {id:"1042", legalName:"Northline Distributors", product:"Distributor App",
    csm1:{name:"Rahul Nair", email:"rahul.nair@company.com", phone:"9812345670", slack:""},
    csm2:{}, lead:{}},
  {id:"1043", legalName:"Verve Foods Ltd", product:"Analytics Pro",
    csm1:{name:"Priya Suresh", email:"", phone:"9900112233", slack:"U08TWRLMU4D"},
    csm2:{name:"Aditi Rao", email:"aditi.rao@company.com", phone:"9876543210", slack:"U05AB12CD"},
    lead:{name:"Manoj Iyer", email:"manoj.iyer@company.com", phone:""}},
  {id:"1044", legalName:"BlueBridge Logistics", product:"Retail Suite",
    csm1:{name:"", email:"", phone:"", slack:""}, csm2:{}, lead:{}},
  {id:"1045", legalName:"Sundew Apparel Co", product:"Distributor App",
    csm1:{name:"Karan Mehta", email:"karan.mehta@company.com", phone:"9845123456", slack:"U05XY34YZ"},
    csm2:{}, lead:{name:"Divya Pillai", email:"divya.pillai@company.com", phone:"9012345678"}},
  {id:"1046", legalName:"Crestpoint Pharma", product:"Analytics Pro",
    csm1:{name:"Rahul Nair", email:"rahul.nair@company.com", phone:"", slack:""},
    csm2:{name:"Priya Suresh", email:"priya.suresh@company.com", phone:"9900112233", slack:"U08TWRLMU4D"},
    lead:{}},
  {id:"1047", legalName:"Meridian Hardware", product:"Retail Suite",
    csm1:{name:"Aditi Rao", email:"aditi.rao@company.com", phone:"9876543210", slack:"U05AB12CD"},
    csm2:{}, lead:{}},
  {id:"1048", legalName:"Falcon Freight Systems", product:"Distributor App",
    csm1:{name:"Neha Bhatt", email:"neha.bhatt@company.com", phone:"9911223344", slack:"U09QQDNJV4H"},
    csm2:{}, lead:{name:"Manoj Iyer", email:"manoj.iyer@company.com", phone:"9223344556"}},
  {id:"1049", legalName:"Coastal Textiles", product:"Analytics Pro",
    csm1:{name:"Priya Suresh", email:"priya.suresh@company.com", phone:"9900112233", slack:"U08TWRLMU4D"},
    csm2:{}, lead:{}},
  {id:"1050", legalName:"Ironclad Fasteners", product:"Retail Suite",
    csm1:{name:"Karan Mehta", email:"", phone:"9845123456", slack:"U05XY34YZ"}, csm2:{}, lead:{}},
  {id:"1051", legalName:"Amara Home Décor", product:"Distributor App",
    csm1:{name:"Neha Bhatt", email:"neha.bhatt@company.com", phone:"9911223344", slack:"U09QQDNJV4H"},
    csm2:{name:"Rahul Nair", email:"rahul.nair@company.com", phone:"9812345670", slack:""}, lead:{}},
  {id:"1052", legalName:"Pinnacle Auto Parts", product:"Analytics Pro",
    csm1:{name:"", email:"", phone:"", slack:""}, csm2:{}, lead:{name:"Sana Vij", email:"sana.vij@company.com", phone:"9123456780"}},
];

/** Get initials from a name string */
export function getInitials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

/** Build a WhatsApp link from a phone number */
export function getWhatsAppLink(phone) {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
  if (clean.length === 10) clean = '91' + clean;
  return `https://wa.me/${clean}`;
}

/** Get sorted list of unique CSM names */
export function getAllCsmNames() {
  const names = new Set();
  CLIENTS.forEach(c => {
    if (c.csm1?.name) names.add(c.csm1.name);
    if (c.csm2?.name) names.add(c.csm2.name);
  });
  return [...names].sort();
}

/** Get sorted list of unique products */
export function getAllProducts() {
  return [...new Set(CLIENTS.map(c => c.product).filter(Boolean))].sort();
}

/** Build CSM directory: sorted array of {name, email, phone, slack} with best available data */
export function getCsmDirectory() {
  const dir = {};
  CLIENTS.forEach(c => {
    [c.csm1, c.csm2].forEach(p => {
      if (p && p.name) {
        if (!dir[p.name] || (!dir[p.name].email && p.email)) {
          dir[p.name] = { ...p };
        }
      }
    });
  });
  return Object.entries(dir)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, info]) => ({ name, ...info }));
}

/** Get filtered + sorted client list */
export function getFilteredClients({ kpi, csm, product, search, sort }) {
  let list = CLIENTS.slice();

  // KPI filter
  if (kpi === 'phone') list = list.filter(c => c.csm1?.name && !c.csm1.phone);
  if (kpi === 'email') list = list.filter(c => c.csm1?.name && !c.csm1.email);

  // CSM filter
  if (csm !== 'All CSMs') {
    list = list.filter(c => c.csm1?.name === csm || c.csm2?.name === csm);
  }

  // Product filter
  if (product !== 'All Products') {
    list = list.filter(c => c.product === product);
  }

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(c =>
      c.legalName.toLowerCase().includes(q) ||
      c.csm1?.name?.toLowerCase().includes(q) ||
      c.csm2?.name?.toLowerCase().includes(q)
    );
  }

  // Sort
  const unassignedLast = (a, b) => (a.csm1?.name ? 0 : 1) - (b.csm1?.name ? 0 : 1);
  const comparators = {
    'csm-az': (a, b) => unassignedLast(a, b) || (a.csm1?.name || '').localeCompare(b.csm1?.name || ''),
    'csm-za': (a, b) => unassignedLast(a, b) || (b.csm1?.name || '').localeCompare(a.csm1?.name || ''),
    'co-az': (a, b) => unassignedLast(a, b) || a.legalName.localeCompare(b.legalName),
    'co-za': (a, b) => unassignedLast(a, b) || b.legalName.localeCompare(a.legalName),
    'id-asc': (a, b) => unassignedLast(a, b) || (+a.id - +b.id),
    'id-desc': (a, b) => unassignedLast(a, b) || (+b.id - +a.id),
  };
  list.sort(comparators[sort] || comparators['csm-az']);
  return list;
}

/** Generate mini bar chart heights */
export function getBarsData(count, max) {
  const n = 8;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const h = Math.max(15, Math.round(((i + 1) / n) * 100 * Math.min(1, (count || 1) / (max || 1))));
    bars.push(h);
  }
  return bars;
}
