import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = '';
let clientStatus = 'disconnected'; // 'disconnected', 'qr', 'loading', 'ready'
// Surfaced through /api/whatsapp/status — without this, a launch failure on
// a host we have no shell/log access to (Render) is completely invisible;
// the process just sits at 'disconnected' forever with no way to diagnose it
let lastInitError = '';

// In-memory message store: { [cleanPhone]: [{id, body, fromMe, timestamp}] }
const messageStore = {};
const chatHistoryPath = path.join(__dirname, 'chat_history.json');

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

// Safely clean JID to phone number, handling multi-device suffixes (e.g. '919999999999:1@c.us' -> '919999999999')
function getCleanPhoneFromJid(jid) {
  if (!jid) return '';
  const partBeforeAt = jid.split('@')[0];
  const partBeforeColon = partBeforeAt.split(':')[0];
  return partBeforeColon.replace(/\D/g, '');
}

// Load history from local JSON file (retaining only last 24 hours of messages,
// and only for numbers still on the CSM roster — older captures made before
// roster-scoping existed can otherwise leak group chats / notification IDs
// back into memory on every restart)
function loadHistoryFromDisk() {
  try {
    if (fs.existsSync(chatHistoryPath)) {
      const data = JSON.parse(fs.readFileSync(chatHistoryPath, 'utf8'));
      const now = Math.floor(Date.now() / 1000);
      const limit = now - 24 * 60 * 60; // 24 hours in seconds
      let dropped = 0;

      Object.keys(data).forEach(phone => {
        if (!isRosterPhone(phone)) { dropped++; return; }
        messageStore[phone] = (data[phone] || []).filter(msg => msg.timestamp >= limit);
      });
      if (dropped > 0) {
        console.log(`Dropped ${dropped} cached thread(s) no longer on the CSM roster.`);
        saveHistoryToDisk();
      }
      console.log('Loaded 24-hour chat history cache from disk.');
    }
  } catch (e) {
    console.error('Error loading history cache:', e.message);
  }
}

// Write history to local JSON file (filtering to keep only last 24 hours)
function saveHistoryToDisk() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const limit = now - 24 * 60 * 60;
    
    const dataToSave = {};
    Object.keys(messageStore).forEach(phone => {
      const filtered = messageStore[phone].filter(msg => msg.timestamp >= limit);
      if (filtered.length > 0) {
        dataToSave[phone] = filtered;
      }
      messageStore[phone] = filtered; // Clean memory map
    });
    
    fs.writeFileSync(chatHistoryPath, JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving history cache:', e.message);
  }
}

import puppeteer from 'puppeteer';

// Helper to find Chrome path on Windows & Linux (Render / Cloud servers)
function getChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const paths = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
    // Linux (Render, Heroku, Docker)
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];

  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }

  try {
    const pPath = puppeteer.executablePath();
    if (pPath && fs.existsSync(pPath)) return pPath;
  } catch (e) {}

  return null;
}

// On Render, the build-time `npx puppeteer browsers install chrome` step can
// resolve to a *different* puppeteer copy than the one this file actually
// imports (npm hoisting / --prefix quirks), so the Chrome build it downloads
// doesn't match what puppeteer.executablePath() expects at runtime — the
// binary is simply never where this process looks for it. Rather than keep
// guessing at the build config from outside, install it ourselves, in-process,
// using the exact puppeteer module already imported here — that guarantees
// the version matches by construction, no build step involved at all.
async function ensureChromeInstalled() {
  if (getChromePath()) return true;

  console.log('[WhatsApp] No Chrome binary found — installing one now (first boot only, may take ~30-60s)...');
  try {
    await new Promise((resolve, reject) => {
      execFile('npx', ['puppeteer', 'browsers', 'install', 'chrome'], { cwd: __dirname, timeout: 120000 }, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve();
      });
    });
    console.log('[WhatsApp] Chrome install finished.');
  } catch (err) {
    console.error('[WhatsApp] Self-install of Chrome failed:', err.message);
  }

  return !!getChromePath();
}

let isRestarting = false;

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

// taskkill /T kills the whole process tree (GPU/renderer/crashpad helpers
// included) — killing just the main PID on Windows can leave those orphaned,
// which is exactly what left a dead Chrome holding the profile lock forever.
function forceKillProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => resolve());
    } else {
      try { process.kill(pid, 'SIGKILL'); } catch (e) {}
      resolve();
    }
  });
}

// client.destroy() resolving is not proof the OS process actually exited —
// in practice it sometimes leaves an orphaned headless Chrome that holds the
// session profile locked, so every subsequent reset/reconnect hangs forever
// waiting on a lock nothing will ever release. Verify, and force-kill if not.
async function ensureBrowserClosed(oldClient) {
  const browserProcess = oldClient?.pupBrowser?.process?.();
  const pid = browserProcess?.pid;

  try {
    await Promise.race([
      oldClient.destroy(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('destroy timeout')), 4000))
    ]);
  } catch (e) {
    // destroy() hung, or the page was already dead underneath it — either
    // way, fall through to the PID check below rather than trusting it
  }

  if (pid && isPidAlive(pid)) {
    console.log(`[WhatsApp Auto-Recovery] Browser process ${pid} still alive after destroy() — force-killing.`);
    await forceKillProcessTree(pid);
  }
}

// Only a genuine unlink invalidates the stored session. A dropped network,
// a sleeping laptop or a phone that went offline all raise 'disconnected'
// too — wiping auth data for those means re-scanning a QR code over a blip,
// which is the opposite of staying logged in.
const UNRECOVERABLE = ['LOGOUT', 'UNPAIRED', 'UNPAIRED_IDLE'];

function isUnrecoverable(reason) {
  return UNRECOVERABLE.some(r => String(reason || '').toUpperCase().includes(r));
}

async function handleLogoutAndRestart(reason, { wipeSession = false } = {}) {
  if (isRestarting) return;
  isRestarting = true;
  console.log('\n============================================================');
  console.log(`  [WhatsApp Auto-Recovery] Disconnected (Reason: ${reason})`);
  console.log(wipeSession
    ? '  Session is no longer valid — clearing auth data and issuing a new QR.'
    : '  Reconnecting with the saved session (auth data kept).');
  console.log('============================================================\n');

  clientStatus = 'loading';
  qrCodeData = '';

  // Wait for (and if needed, force) the old browser process to actually die
  // before touching its profile directory or launching a new one — skipping
  // this is exactly what left an orphaned Chrome holding the session lock
  // forever, hanging every subsequent connect attempt.
  if (client) {
    const oldClient = client;
    client = null;
    await ensureBrowserClosed(oldClient);
  }

  const restart = () => {
    setTimeout(() => {
      isRestarting = false;
      initWhatsApp();
    }, 500);
  };

  if (!wipeSession) {
    // Reconnect against the existing LocalAuth data — no re-scan needed
    setTimeout(restart, 500);
    return;
  }

  // Small delay so LocalAuth's own internal unlinking (if any) settles
  // before we sweep the directory ourselves
  setTimeout(() => {
    const authDir = path.join(__dirname, '.wwebjs_auth');
    fs.rm(authDir, { recursive: true, force: true }, (err) => {
      if (!err) {
        console.log('[WhatsApp Auto-Recovery] Cleared stale session data directory.');
      } else {
        console.error('[WhatsApp Auto-Recovery] Could not fully clear session directory:', err.message);
      }
      restart();
    });
  }, 500);
}

export async function initWhatsApp() {
  console.log("Initializing WhatsApp background client...");

  await ensureChromeInstalled();

  // Load local persistent cache
  loadHistoryFromDisk();
  
  // Auto-clean any stale Chromium lock files left by crashed previous runs
  const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session');
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'DevToolsActivePort'];
  
  const cleanLocks = (dir) => {
    if (!fs.existsSync(dir)) return;
    lockFiles.forEach(f => {
      const lockPath = path.join(dir, f);
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          console.log(`Cleaned up stale lock file: ${f}`);
        }
      } catch (e) {
        // Ignore errors if file is locked/not deletable
      }
    });
  };
  cleanLocks(sessionDir);
  cleanLocks(path.join(sessionDir, 'Default'));
  
  const puppeteerOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ]
  };
  
  // Use system Chrome for best compatibility on Windows
  const chromePath = getChromePath();
  if (chromePath) {
    console.log(`Using system Chrome at: ${chromePath}`);
    puppeteerOpts.executablePath = chromePath;
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '.wwebjs_auth')
    }),
    puppeteer: puppeteerOpts
  });

  client.on('qr', async (qr) => {
    try {
      qrCodeData = await qrcode.toDataURL(qr);
      clientStatus = 'qr';
      console.log('\n============================================================');
      console.log('  [WhatsApp] QR Code generated! Scan it in the dashboard UI.');
      console.log('============================================================\n');
    } catch (err) {
      console.error('Failed to convert QR code to data URL:', err.message);
    }
  });

  client.on('ready', () => {
    clientStatus = 'ready';
    qrCodeData = '';
    lastInitError = '';
    console.log('✅ WhatsApp client is ready and connected!');
  });

  client.on('authenticated', () => {
    clientStatus = 'loading';
    console.log('WhatsApp authenticated successfully.');
  });

  client.on('auth_failure', (msg) => {
    // Stored credentials were rejected — the session really is dead
    console.error('WhatsApp authentication failure:', msg);
    handleLogoutAndRestart('auth_failure: ' + msg, { wipeSession: true });
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp client was disconnected:', reason);
    handleLogoutAndRestart('disconnected: ' + reason, { wipeSession: isUnrecoverable(reason) });
  });

  // Capture messages for CSM roster contacts only — this account is your
  // real WhatsApp, but the dashboard should only ever remember chats with
  // the people you've named, not every personal conversation on your phone
  client.on('message_create', (msg) => {
    // Resolve the target phone number depending on whether the message is outgoing (to) or incoming (from)
    const targetJid = msg.fromMe ? msg.to : msg.from;
    const phone = getCleanPhoneFromJid(targetJid);
    if (!phone || !isRosterPhone(phone)) return;

    console.log(`[WhatsApp] Message event: ${msg.fromMe ? '📤 Outgoing to' : '📥 Incoming from'} ${phone}: "${msg.body || '(media)'}"`);

    if (!messageStore[phone]) messageStore[phone] = [];

    // Avoid duplicate message IDs
    const exists = messageStore[phone].some(m => m.id === msg.id._serialized);
    if (!exists) {
      messageStore[phone].push({
        id: msg.id._serialized,
        body: msg.body || '',
        fromMe: msg.fromMe,
        timestamp: msg.timestamp,
        type: msg.type || 'chat'
      });
      // Sort to preserve correct chronological order
      messageStore[phone].sort((a, b) => a.timestamp - b.timestamp);
      saveHistoryToDisk();
    }
  });

  client.initialize().catch(err => {
    lastInitError = err.message || String(err);
    console.error("Failed to initialize WhatsApp client:", lastInitError);
    clientStatus = 'disconnected';
    qrCodeData = '';

    // A launch failure otherwise sticks at 'disconnected' forever with no
    // way to recover short of a manual reset. Most causes on a fresh host
    // (transient resource pressure on cold start) clear up on their own —
    // retry with backoff instead of requiring someone to notice and click reset.
    console.log('[WhatsApp] Retrying initialization in 20s...');
    setTimeout(() => {
      if (clientStatus === 'disconnected') initWhatsApp();
    }, 20000);
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
  if (clientStatus !== 'ready') {
    throw new Error('WhatsApp client is not connected.');
  }
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) {
    throw new Error('This number is not on the CSM roster.');
  }

  const whatsappId = `${cleanPhone}@c.us`;
  await client.sendMessage(whatsappId, text);
  return { success: true };
}

export async function sendWhatsAppMedia(phone, filePath, caption) {
  if (clientStatus !== 'ready') {
    throw new Error('WhatsApp client is not connected.');
  }
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) {
    throw new Error('This number is not on the CSM roster.');
  }

  const whatsappId = `${cleanPhone}@c.us`;
  const media = MessageMedia.fromFilePath(filePath);
  // Send media with the provided caption (message text or filename fallback)
  await client.sendMessage(whatsappId, media, { caption: caption || '' });
  return { success: true };
}

// Fetch real chat history from WhatsApp Web for a given phone number —
// restricted to the CSM roster, so the dashboard never surfaces a personal chat
export async function fetchChatHistory(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) return [];
  const whatsappId = `${cleanPhone}@c.us`;

  const now = Math.floor(Date.now() / 1000);
  const limit = now - 24 * 60 * 60; // 24 hours in seconds

  try {
    if (clientStatus !== 'ready') throw new Error('Not ready');
    const chat = await client.getChatById(whatsappId);
    const msgs = await chat.fetchMessages({ limit: 50 });
    
    // Convert to simplified layout and filter to last 24 hours
    const result = msgs
      .filter(m => m.timestamp >= limit)
      .map(m => ({
        id: m.id._serialized,
        body: m.body || '',
        fromMe: m.fromMe,
        timestamp: m.timestamp,
        type: m.type || 'chat'
      }));

    // Merge into local cache store
    if (!messageStore[cleanPhone]) messageStore[cleanPhone] = [];
    result.forEach(newMsg => {
      const exists = messageStore[cleanPhone].some(m => m.id === newMsg.id);
      if (!exists) {
        messageStore[cleanPhone].push(newMsg);
      }
    });

    // Keep memory map sorted & saved
    messageStore[cleanPhone].sort((a, b) => a.timestamp - b.timestamp);
    saveHistoryToDisk();

    return messageStore[cleanPhone].filter(m => m.timestamp >= limit);
  } catch (e) {
    // Fallback to locally stored history
    return (messageStore[cleanPhone] || []).filter(msg => msg.timestamp >= limit);
  }
}

// Get only in-memory messages (for polling new incoming, limited to 24 hours)
export function getStoredMessages(phone) {
  const cleanPhone = normalizePhone(phone);
  if (!isRosterPhone(cleanPhone)) return [];
  const now = Math.floor(Date.now() / 1000);
  const limit = now - 24 * 60 * 60;
  return (messageStore[cleanPhone] || []).filter(m => m.timestamp >= limit);
}

// Reset WhatsApp session completely (delete session dir & start fresh client)
export async function resetWhatsApp() {
  // Explicit user action from the UI — this one is meant to force a re-scan
  await handleLogoutAndRestart('manual_reset', { wipeSession: true });
  return { success: true };
}
