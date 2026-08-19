import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  initAuthCreds,
  BufferJSON,
  proto
} from 'baileys';
import pino from 'pino';
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { connectMongo as connectSharedMongo } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Baileys speaks WhatsApp's protocol directly over WebSocket — no Chrome, no
// Puppeteer. Measured: ~50MB for this whole session vs. ~620MB for the old
// whatsapp-web.js/Chrome stack, which is what was blowing Render's 512MB
// free-tier limit. This is a fresh auth store (.baileys_auth, not
// .wwebjs_auth) — the old session format doesn't carry over, so this needs
// one new QR scan after deploying, same as any first-time connect.
const authDir = path.join(__dirname, '.baileys_auth');

// Render's free tier wipes the local filesystem on every restart/redeploy/
// idle spin-down, which would otherwise mean re-scanning a QR code any time
// the instance sleeps. When MONGODB_URI is set, auth state (login session +
// encryption keys) is persisted there instead of the local folder above; the
// folder remains the fallback for local dev with no Mongo configured.
let authBackend = 'file';

const authDocSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  json: { type: String, required: true }
}, { collection: 'whatsapp_auth', versionKey: false });

const WhatsAppAuthDoc = mongoose.models.WhatsAppAuthDoc || mongoose.model('WhatsAppAuthDoc', authDocSchema);

// Same ephemeral-disk exposure as the auth store above, just for message
// content instead of login state: chat_history.json and the in-memory
// messageStore both live only on local disk otherwise, so a restart wipes
// any message not yet re-synced from WhatsApp's own history. One document
// per phone number, mirroring messageStore's own shape.
let historyBackend = 'file';

const messageHistoryDocSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // phone
  messages: { type: Array, default: [] }
}, { collection: 'whatsapp_messages', versionKey: false });

const WhatsAppMessageDoc = mongoose.models.WhatsAppMessageDoc || mongoose.model('WhatsAppMessageDoc', messageHistoryDocSchema);

async function connectMongo() {
  try {
    return await connectSharedMongo();
  } catch (e) {
    console.error('[WhatsApp] MongoDB connection failed, falling back to local auth folder:', e.message);
    return false;
  }
}

// Mirrors Baileys' own useMultiFileAuthState (same BufferJSON encoding, same
// per-key get/set/remove shape) but backed by a Mongo collection instead of
// one file per key, so it survives a restart on Render's free tier.
async function useMongoAuthState() {
  const readData = async (key) => {
    const doc = await WhatsAppAuthDoc.findById(key).lean();
    if (!doc) return null;
    return JSON.parse(doc.json, BufferJSON.reviver);
  };
  const writeData = async (key, data) => {
    await WhatsAppAuthDoc.findByIdAndUpdate(
      key,
      { json: JSON.stringify(data, BufferJSON.replacer) },
      { upsert: true }
    );
  };
  const removeData = async (key) => {
    await WhatsAppAuthDoc.findByIdAndDelete(key);
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(ids.map(async (id) => {
            let value = await readData(`${type}-${id}`);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }));
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => writeData('creds', creds)
  };
}

async function getAuthState() {
  const usingMongo = await connectMongo();
  authBackend = usingMongo ? 'mongo' : 'file';
  if (usingMongo) {
    console.log('[WhatsApp] Using MongoDB-backed auth store — session will survive Render restarts.');
    return useMongoAuthState();
  }
  console.log('[WhatsApp] MONGODB_URI not set — using local .baileys_auth folder (session will NOT survive a Render free-tier restart).');
  return useMultiFileAuthState(authDir);
}

async function clearAuthState() {
  if (authBackend === 'mongo') {
    await WhatsAppAuthDoc.deleteMany({});
  } else {
    await new Promise(resolve => fs.rm(authDir, { recursive: true, force: true }, () => resolve()));
  }
}

let client = null;
let qrCodeData = '';
let clientStatus = 'disconnected'; // 'disconnected', 'qr', 'loading', 'ready'
let lastInitError = '';

// How long a CSM's chat stays visible on the dashboard before it's dropped —
// applied uniformly on every load/save/fetch, so a message older than this
// simply stops appearing rather than needing an explicit cleanup job.
const RETENTION_SECONDS = 15 * 24 * 60 * 60;

// In-memory message store: { [cleanPhone]: [{id, body, fromMe, timestamp}] }
const messageStore = {};
const chatHistoryPath = path.join(__dirname, 'chat_history.json');

// Quiet by default — Baileys' own logger is fairly verbose at info level,
// which would flood Render's logs; our own console.log calls below cover
// the events we actually care about.
const logger = pino({ level: 'silent' });

function normalizePhone(phone) {
  let clean = String(phone || '').replace(/\D/g, '');
  if (clean.length === 10) clean = '91' + clean;
  return clean;
}

// The dashboard's WhatsApp session is scoped to the CSM roster only — it
// links your real WhatsApp account, but should behave like a fresh device
// that only ever talks to the people you've named, not a mirror of every
// personal chat on your phone. server.js keeps this in sync with the sheet.
let rosterPhones = new Set();

export function setRosterPhones(phones) {
  rosterPhones = new Set((phones || []).map(normalizePhone).filter(Boolean));
}

function isRosterPhone(cleanPhone) {
  return rosterPhones.has(cleanPhone);
}

// One latest-message-per-contact snapshot, for a WhatsApp-style chat list —
// a real client-side inbox screen, not the single-thread view. Cheap: reads
// the in-memory store already scoped to the roster, no WhatsApp API calls.
export function getRosterSummaries() {
  const summaries = {};
  for (const phone of rosterPhones) {
    const thread = messageStore[phone];
    if (!thread || thread.length === 0) continue;
    summaries[phone] = thread[thread.length - 1];
  }
  return summaries;
}

// Baileys JIDs look like '919999999999@s.whatsapp.net' (individuals) or
// '...@g.us' (groups) — strip the suffix and any device-id segment down to
// a plain phone number, same idea as the old @c.us stripping.
function getCleanPhoneFromJid(jid) {
  if (!jid) return '';
  const partBeforeAt = jid.split('@')[0];
  const partBeforeColon = partBeforeAt.split(':')[0];
  return partBeforeColon.replace(/\D/g, '');
}

function toJid(cleanPhone) {
  return `${cleanPhone}@s.whatsapp.net`;
}

// messageTimestamp can arrive as a plain number or a protobuf Long — this
// normalizes either into a plain unix-seconds number safely.
function toUnixSeconds(ts) {
  if (ts == null) return Math.floor(Date.now() / 1000);
  if (typeof ts === 'number') return ts;
  if (typeof ts.toNumber === 'function') return ts.toNumber();
  return Number(ts) || Math.floor(Date.now() / 1000);
}

// Baileys nests message content by type instead of a flat .body string —
// this covers the shapes a CSM conversation will actually produce. Media
// sent without a caption has no text at all, so without a placeholder it
// would look like it never arrived (and messages.upsert already drops
// anything with an empty body) — a labeled placeholder keeps it visible.
function extractMessageText(m) {
  const c = m?.message;
  if (!c) return '';
  if (c.conversation) return c.conversation;
  if (c.extendedTextMessage?.text) return c.extendedTextMessage.text;
  if (c.imageMessage) return c.imageMessage.caption || 'Image received';
  if (c.videoMessage) return c.videoMessage.caption || 'Video received';
  if (c.documentMessage) return c.documentMessage.caption || `Document received: ${c.documentMessage.fileName || 'file'}`;
  if (c.audioMessage) return c.audioMessage.ptt ? 'Voice message received' : 'Audio received';
  if (c.stickerMessage) return 'Sticker received';
  return '';
}

// Load history (retaining only the last RETENTION_SECONDS of messages, and
// only for numbers still on the CSM roster — older captures made before
// roster-scoping existed can otherwise leak group chats / notification IDs
// back into memory on every restart). MongoDB when configured; the local
// JSON file otherwise, for local dev with no Mongo set up.
async function loadHistoryFromDisk() {
  const usingMongo = await connectMongo().catch(() => false);
  historyBackend = usingMongo ? 'mongo' : 'file';

  const now = Math.floor(Date.now() / 1000);
  const limit = now - RETENTION_SECONDS;
  let dropped = 0;

  if (usingMongo) {
    try {
      const docs = await WhatsAppMessageDoc.find({}).lean();
      docs.forEach(doc => {
        const phone = doc._id;
        if (!isRosterPhone(phone)) { dropped++; return; }
        messageStore[phone] = (doc.messages || []).filter(msg => msg.timestamp >= limit);
      });
      if (dropped > 0) {
        console.log(`Dropped ${dropped} cached thread(s) no longer on the CSM roster.`);
        await saveHistoryToDisk();
      }
      console.log(`Loaded ${RETENTION_SECONDS / 86400}-day chat history cache from MongoDB.`);
    } catch (e) {
      console.error('Error loading history cache from MongoDB:', e.message);
    }
    return;
  }

  try {
    if (fs.existsSync(chatHistoryPath)) {
      const data = JSON.parse(fs.readFileSync(chatHistoryPath, 'utf8'));
      Object.keys(data).forEach(phone => {
        if (!isRosterPhone(phone)) { dropped++; return; }
        messageStore[phone] = (data[phone] || []).filter(msg => msg.timestamp >= limit);
      });
      if (dropped > 0) {
        console.log(`Dropped ${dropped} cached thread(s) no longer on the CSM roster.`);
        await saveHistoryToDisk();
      }
      console.log(`Loaded ${RETENTION_SECONDS / 86400}-day chat history cache from disk.`);
    }
  } catch (e) {
    console.error('Error loading history cache:', e.message);
  }
}

// Write history (filtering to keep only the retention window). Persists
// every roster phone's thread, not just the one that just changed — cheap
// at this scale (a roster's worth of threads, not thousands) and keeps the
// same "always a consistent full snapshot" behavior the file version had.
async function saveHistoryToDisk() {
  const now = Math.floor(Date.now() / 1000);
  const limit = now - RETENTION_SECONDS;

  const dataToSave = {};
  Object.keys(messageStore).forEach(phone => {
    const filtered = messageStore[phone].filter(msg => msg.timestamp >= limit);
    if (filtered.length > 0) {
      dataToSave[phone] = filtered;
    }
    messageStore[phone] = filtered; // Clean memory map
  });

  if (historyBackend === 'mongo') {
    try {
      const keepPhones = Object.keys(dataToSave);
      const ops = keepPhones.map(phone => ({
        replaceOne: {
          filter: { _id: phone },
          replacement: { _id: phone, messages: dataToSave[phone] },
          upsert: true
        }
      }));
      if (ops.length > 0) await WhatsAppMessageDoc.bulkWrite(ops);
      // Guard against an empty in-memory store (e.g. this ran before the
      // initial load populated it) wiping every doc via an unbounded $nin
      if (keepPhones.length > 0) {
        await WhatsAppMessageDoc.deleteMany({ _id: { $nin: keepPhones } });
      }
    } catch (e) {
      console.error('Error saving history cache to MongoDB:', e.message);
    }
    return;
  }

  try {
    fs.writeFileSync(chatHistoryPath, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving history cache:', e.message);
  }
}

// Record one message into the roster-scoped store, deduped by id, kept sorted
function recordMessage(phone, entry) {
  if (!messageStore[phone]) messageStore[phone] = [];
  const exists = messageStore[phone].some(m => m.id === entry.id);
  if (exists) return false;
  messageStore[phone].push(entry);
  messageStore[phone].sort((a, b) => a.timestamp - b.timestamp);
  return true;
}

// initWhatsApp() can be triggered from three places (initial boot, the retry
// loop on failure, and a manual reset) with no natural coordination between
// them — this flag keeps only one connect attempt in flight at a time, and
// queues (rather than drops) a call that arrives mid-attempt.
let initInFlight = false;
let initQueued = false;

export async function initWhatsApp() {
  if (initInFlight) {
    console.log('[WhatsApp] Init already in progress — queuing this call for right after.');
    initQueued = true;
    return;
  }
  initInFlight = true;
  clientStatus = 'loading';
  console.log('Initializing WhatsApp background client...');

  try {
    await initWhatsAppInner();
  } catch (err) {
    lastInitError = err.message || String(err);
    console.error('Failed to initialize WhatsApp client:', lastInitError);
    clientStatus = 'disconnected';
    qrCodeData = '';
    console.log('[WhatsApp] Retrying initialization in 20s...');
    setTimeout(() => {
      if (clientStatus === 'disconnected') initWhatsApp();
    }, 20000);
  } finally {
    initInFlight = false;
    if (initQueued) {
      initQueued = false;
      initWhatsApp();
    }
  }
}

async function initWhatsAppInner() {
  await loadHistoryFromDisk();

  const { state, saveCreds } = await getAuthState();
  const { version } = await fetchLatestBaileysVersion();

  client = makeWASocket({
    auth: state,
    version,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    // We render our own QR image via the qrcode package instead
    printQRInTerminal: false,
    // Pulls real prior conversation history on first connect (feeds the
    // messaging-history.set handler below) instead of starting from empty
    syncFullHistory: true,
    markOnlineOnConnect: false
  });

  client.ev.on('creds.update', saveCreds);

  client.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      try {
        qrCodeData = await qrcode.toDataURL(qr);
        clientStatus = 'qr';
        console.log('\n============================================================');
        console.log('  [WhatsApp] QR Code generated! Scan it in the dashboard UI.');
        console.log('============================================================\n');
      } catch (err) {
        console.error('Failed to convert QR code to data URL:', err.message);
      }
      return;
    }

    if (connection === 'open') {
      clientStatus = 'ready';
      qrCodeData = '';
      lastInitError = '';
      console.log('✅ WhatsApp client is ready and connected!');
      return;
    }

    if (connection === 'connecting') {
      clientStatus = 'loading';
      return;
    }

    if (connection === 'close') {
      // Only a genuine unlink invalidates the stored session. A dropped
      // network, a sleeping laptop or a phone that went offline all raise
      // 'close' too — wiping auth data for those means re-scanning a QR
      // over a blip, which is the opposite of staying logged in.
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      console.log('WhatsApp connection closed:', lastDisconnect?.error?.message || statusCode || 'unknown reason');
      clientStatus = 'loading';
      qrCodeData = '';
      client = null;

      if (!loggedOut) {
        setTimeout(() => initWhatsApp(), 500);
        return;
      }

      console.log('\n============================================================');
      console.log('  [WhatsApp Auto-Recovery] Logged out — clearing auth data and issuing a new QR.');
      console.log('============================================================\n');
      clearAuthState().finally(() => {
        setTimeout(() => initWhatsApp(), 500);
      });
    }
  });

  // First-connect history push — real prior WhatsApp conversation history,
  // not just messages sent through the dashboard. Baileys delivers this as
  // one bulk event rather than an on-demand per-chat fetch.
  client.ev.on('messaging-history.set', async ({ messages }) => {
    let added = 0;
    for (const m of messages || []) {
      const jid = m.key?.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
      const phone = getCleanPhoneFromJid(jid);
      if (!phone || !isRosterPhone(phone)) continue;

      const body = extractMessageText(m);
      if (!body) continue; // skip non-text history entries (calls, system events, etc.)

      const added_ = recordMessage(phone, {
        id: m.key.id,
        body,
        fromMe: !!m.key.fromMe,
        timestamp: toUnixSeconds(m.messageTimestamp),
        type: 'chat'
      });
      if (added_) added++;
    }
    if (added > 0) {
      console.log(`[WhatsApp] Synced ${added} historical message(s) for CSM roster contacts.`);
      await saveHistoryToDisk();
    }
  });

  // Capture messages for CSM roster contacts only — this account is your
  // real WhatsApp, but the dashboard should only ever remember chats with
  // the people you've named, not every personal conversation on your phone
  client.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages || []) {
      const jid = m.key?.remoteJid;
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
      const phone = getCleanPhoneFromJid(jid);
      if (!phone || !isRosterPhone(phone)) continue;

      const body = extractMessageText(m);
      if (!body) continue; // non-text protocol/system events (reactions, receipts, etc.)
      const fromMe = !!m.key.fromMe;

      console.log(`[WhatsApp] Message event: ${fromMe ? '📤 Outgoing to' : '📥 Incoming from'} ${phone}: "${body}"`);

      const added = recordMessage(phone, {
        id: m.key.id,
        body,
        fromMe,
        timestamp: toUnixSeconds(m.messageTimestamp),
        type: 'chat'
      });
      if (added) await saveHistoryToDisk();
    }
  });
}

export function getWhatsAppStatus() {
  return {
    status: clientStatus,
    qr: qrCodeData,
    lastError: clientStatus === 'disconnected' ? lastInitError : ''
  };
}

export async function sendWhatsAppMessage(phone, text) {
  if (clientStatus !== 'ready' || !client) {
    throw new Error('WhatsApp client is not connected.');
  }
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) {
    throw new Error('This number is not on the CSM roster.');
  }

  const sent = await client.sendMessage(toJid(cleanPhone), { text });
  const id = sent?.key?.id || `local-${Date.now()}`;
  const timestamp = toUnixSeconds(sent?.messageTimestamp);

  // Record immediately with the real Baileys id, instead of waiting for the
  // messages.upsert echo — the dashboard's own optimistic bubble otherwise
  // has no way to recognize the echoed copy as the same message and ends up
  // showing both. messages.upsert's own recordMessage() dedupes by id, so
  // if the echo does arrive later it's a no-op, not a second entry.
  if (recordMessage(cleanPhone, { id, body: text, fromMe: true, timestamp, type: 'chat' })) {
    await saveHistoryToDisk();
  }

  return { success: true, id, timestamp };
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|bmp)$/i;

export async function sendWhatsAppMedia(phone, filePath, caption) {
  if (clientStatus !== 'ready' || !client) {
    throw new Error('WhatsApp client is not connected.');
  }
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) {
    throw new Error('This number is not on the CSM roster.');
  }

  const jid = toJid(cleanPhone);
  const content = IMAGE_EXTENSIONS.test(filePath)
    ? { image: { url: filePath }, caption: caption || '' }
    : { document: { url: filePath }, fileName: path.basename(filePath), caption: caption || '' };

  await client.sendMessage(jid, content);
  return { success: true };
}

// Real WhatsApp history for a roster contact. Unlike whatsapp-web.js, Baileys
// has no on-demand "fetch this chat's messages" call — history arrives
// passively via messaging-history.set on connect and messages.upsert as it
// happens, both already feeding messageStore, so this just reads it back.
export async function fetchChatHistory(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) return [];
  const now = Math.floor(Date.now() / 1000);
  const limit = now - RETENTION_SECONDS;
  return (messageStore[cleanPhone] || []).filter(m => m.timestamp >= limit);
}

// Get only in-memory messages (for polling new incoming, within the retention window)
export function getStoredMessages(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) return [];
  const now = Math.floor(Date.now() / 1000);
  const limit = now - RETENTION_SECONDS;
  return (messageStore[cleanPhone] || []).filter(m => m.timestamp >= limit);
}

// Reset WhatsApp session completely (delete auth dir & start fresh client) —
// explicit user action from the UI, always means "force a re-scan"
export async function resetWhatsApp() {
  console.log('\n============================================================');
  console.log('  [WhatsApp Auto-Recovery] Manual reset — clearing auth data and issuing a new QR.');
  console.log('============================================================\n');

  clientStatus = 'loading';
  qrCodeData = '';

  if (client) {
    try { client.end(new Error('manual_reset')); } catch (e) {}
    client = null;
  }

  await clearAuthState();

  await initWhatsApp();
  return { success: true };
}
