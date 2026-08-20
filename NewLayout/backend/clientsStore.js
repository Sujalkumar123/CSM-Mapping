import mongoose from 'mongoose';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectMongo } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same ephemeral-disk problem as WhatsApp auth: this xlsx file lives on
// Render's local filesystem, wiped on every redeploy/restart/free-tier
// spin-down — any add/edit/delete made through the dashboard was silently
// reverted on the next deploy. When MONGODB_URI is set, the client/CSM
// directory is persisted there instead; the xlsx stays as the local-dev
// fallback and as the one-time seed source for the Mongo collection.
const EXCEL_PATH = path.join(__dirname, '..', '..', 'csm_company_mappings (14).xlsx');

const cleanColumns = [
  "id", "legalName", "aliasBrand", "product",
  "csm_name_1", "csm_contact_1", "csm_email_1",
  "csm_name_2", "csm_email_2", "csm_contact_2",
  "lead_name", "lead_contact", "lead_email",
  "csm_slack_1", "csm_slack_2"
];

const personSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  slack: { type: String, default: '' },
  // Only meaningful on csm1: which tier (L1 Support / Customer Success
  // Executive / Senior CSE / Customer Success Manager) actually filled the
  // "primary" slot, since it cascades through whichever one has a name.
  role: { type: String, default: '' }
}, { _id: false });

const leadSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  slack: { type: String, default: '' }
}, { _id: false });

// The sheet's own "id" column is NOT a reliable unique key — 80 distinct
// values are shared across 2-3 rows each in the live data (different
// company/product rows that happen to carry the same id). The old xlsx
// array tolerated that silently (edits/deletes just hit whichever row
// matched first). Mongo needs a real unique key, so each doc gets its own
// ObjectId internally and "id" stays a plain, non-unique field — same
// tolerant behavior, no rows silently dropped.
const hierarchyEntrySchema = new mongoose.Schema({
  role: { type: String, default: '' },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  slack: { type: String, default: '' }
}, { _id: false });

const clientSchema = new mongoose.Schema({
  id: { type: String, default: '' },
  legalName: { type: String, default: '' },
  product: { type: String, default: '' },
  csm1: { type: personSchema, default: () => ({}) },
  csm2: { type: personSchema, default: () => ({}) },
  lead: { type: leadSchema, default: () => ({}) },
  // Every populated tier (L1 through VP), in ascending seniority order,
  // blanks skipped — csm1/csm2/lead above stay Primary/AVP/VP specifically
  // for the roster sync, messaging targets, and Unified Inbox, which don't
  // need the full chain. This is purely for the client card, which does:
  // a client can have more than 3 tiers filled (Senior CSE + CSM + AVP + VP
  // is a real, common case), and collapsing that down to 3 fixed slots was
  // silently discarding whichever tiers didn't make the cut.
  hierarchy: { type: [hierarchyEntrySchema], default: () => [] }
}, { collection: 'clients', versionKey: false });

const ClientDoc = mongoose.models.ClientDoc || mongoose.model('ClientDoc', clientSchema);

let clientsCache = null;
let backend = 'file'; // 'mongo' | 'file' — which store served the last read

function docToClient(doc) {
  return {
    id: doc.id || '',
    legalName: doc.legalName || '',
    product: doc.product || '',
    csm1: {
      name: doc.csm1?.name || '', email: doc.csm1?.email || '',
      phone: doc.csm1?.phone || '', slack: doc.csm1?.slack || '',
      role: doc.csm1?.role || ''
    },
    csm2: {
      name: doc.csm2?.name || '', email: doc.csm2?.email || '',
      phone: doc.csm2?.phone || '', slack: doc.csm2?.slack || ''
    },
    lead: {
      name: doc.lead?.name || '', email: doc.lead?.email || '',
      phone: doc.lead?.phone || '', slack: doc.lead?.slack || ''
    },
    hierarchy: (doc.hierarchy || []).map(h => ({
      role: h.role || '', name: h.name || '', email: h.email || '',
      phone: h.phone || '', slack: h.slack || ''
    }))
  };
}

// ---- xlsx (local dev fallback + one-time Mongo seed source) ----

function readExcelFile() {
  if (!fs.existsSync(EXCEL_PATH)) return [];

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length === 0) return [];

  const rows = rawRows.slice(1);
  return rows.map(row => {
    const item = {};
    cleanColumns.forEach((col, index) => {
      let val = row[index];
      if (val === undefined || val === null) val = '';
      val = String(val).trim();
      if (val.replace('.', '', 1).match(/^\d+$/)) val = val.replace(/\.0+$/, '');
      if (val === '0' || val === '1') val = '';
      item[col] = val;
    });

    return {
      id: item.id || '',
      legalName: item.legalName || '',
      product: item.product || '',
      csm1: { name: item.csm_name_1 || '', email: item.csm_email_1 || '', phone: item.csm_contact_1 || '', slack: item.csm_slack_1 || '' },
      csm2: { name: item.csm_name_2 || '', email: item.csm_email_2 || '', phone: item.csm_contact_2 || '', slack: item.csm_slack_2 || '' },
      lead: { name: item.lead_name || '', email: item.lead_email || '', phone: item.lead_contact || '' }
    };
  });
}

function writeExcelFile(clients) {
  const originalHeaders = [
    "id", "legalName", "aliasBrand", "product",
    "CSM Name 1", "CSM Contact", "CSM EmailId",
    "CSM Name 2", "CSM EmailID", "CSM Contact",
    "leadName", "leadName Contact", "lead EmailID",
    "CSM Slack ID", "CSM 2 Slack ID"
  ];
  const sheetData = [originalHeaders];

  clients.forEach(c => {
    sheetData.push([
      c.id || '', c.legalName || '', '', c.product || '',
      c.csm1?.name || '', c.csm1?.phone || '', c.csm1?.email || '',
      c.csm2?.name || '', c.csm2?.email || '', c.csm2?.phone || '',
      c.lead?.name || '', c.lead?.phone || '', c.lead?.email || '',
      c.csm1?.slack || '', c.csm2?.slack || ''
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mappings');
  XLSX.writeFile(workbook, EXCEL_PATH);
}

// ---- mongo ----

async function readMongoClients() {
  const docs = await ClientDoc.find({}).sort({ _id: 1 }).lean();
  return docs.map(docToClient);
}

// Full-snapshot replace — same shape as the old "rewrite the whole xlsx"
// behavior, and the only safe option given "id" isn't unique: there's no
// single field to upsert against without silently merging distinct rows
// that happen to share an id.
async function writeMongoClients(clients) {
  await ClientDoc.deleteMany({});
  if (clients.length > 0) {
    await ClientDoc.insertMany(clients.map(c => ({
      id: c.id || '',
      legalName: c.legalName || '',
      product: c.product || '',
      csm1: c.csm1 || {},
      csm2: c.csm2 || {},
      lead: c.lead || {},
      hierarchy: c.hierarchy || []
    })));
  }
}

export async function readClients(forceReload = false) {
  if (clientsCache && !forceReload) return clientsCache;

  const usingMongo = await connectMongo().catch(err => {
    console.error('[Clients] MongoDB connection failed, falling back to local xlsx file:', err.message);
    return false;
  });
  backend = usingMongo ? 'mongo' : 'file';

  if (usingMongo) {
    let docs = await readMongoClients();
    if (docs.length === 0) {
      // Empty collection — either first boot with Mongo configured, or the
      // collection was cleared. Seed once from the xlsx (whatever's on this
      // instance's disk right now) so switching backends is never a
      // "clients suddenly disappeared" moment.
      const fileClients = readExcelFile();
      if (fileClients.length > 0) {
        await writeMongoClients(fileClients);
        console.log(`[Clients] Seeded MongoDB with ${fileClients.length} record(s) from the local xlsx.`);
        docs = fileClients;
      }
    }
    clientsCache = docs;
    return clientsCache;
  }

  console.log('[Clients] MONGODB_URI not set — using local xlsx file (edits will NOT survive a Render free-tier restart).');
  clientsCache = readExcelFile();
  return clientsCache;
}

export async function writeClients(clients) {
  clientsCache = clients;
  if (backend === 'mongo') {
    await writeMongoClients(clients);
  } else {
    writeExcelFile(clients);
  }
}
