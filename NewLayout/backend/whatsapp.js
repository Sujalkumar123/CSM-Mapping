import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = '';
let clientStatus = 'disconnected'; // 'disconnected', 'qr', 'loading', 'ready'

// In-memory message store: { [cleanPhone]: [{id, body, fromMe, timestamp}] }
const messageStore = {};
const chatHistoryPath = path.join(__dirname, 'chat_history.json');

// Safely clean JID to phone number, handling multi-device suffixes (e.g. '919999999999:1@c.us' -> '919999999999')
function getCleanPhoneFromJid(jid) {
  if (!jid) return '';
  const partBeforeAt = jid.split('@')[0];
  const partBeforeColon = partBeforeAt.split(':')[0];
  return partBeforeColon.replace(/\D/g, '');
}

// Load history from local JSON file (retaining only last 24 hours of messages)
function loadHistoryFromDisk() {
  try {
    if (fs.existsSync(chatHistoryPath)) {
      const data = JSON.parse(fs.readFileSync(chatHistoryPath, 'utf8'));
      const now = Math.floor(Date.now() / 1000);
      const limit = now - 24 * 60 * 60; // 24 hours in seconds
      
      Object.keys(data).forEach(phone => {
        messageStore[phone] = (data[phone] || []).filter(msg => msg.timestamp >= limit);
      });
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

// Helper to find Chrome path on Windows
function getChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

export function initWhatsApp() {
  console.log("Initializing WhatsApp background client...");
  
  // Load local persistent cache
  loadHistoryFromDisk();
  
  // Auto-clean any stale Chromium lock files left by crashed previous runs
  const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session');
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  lockFiles.forEach(f => {
    const lockPath = path.join(sessionDir, f);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        console.log(`Cleaned up stale lock file: ${f}`);
      }
    } catch (e) {
      // Ignore errors if file is not deletable
    }
  });
  
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

  client.on('qr', (qr) => {
    clientStatus = 'qr';
    qrcode.toDataURL(qr, (err, url) => {
      if (!err) qrCodeData = url;
    });
    console.log('\n============================================================');
    console.log('  [WhatsApp] QR Code generated! Scan it in the dashboard UI.');
    console.log('============================================================\n');
  });

  client.on('ready', () => {
    clientStatus = 'ready';
    qrCodeData = '';
    console.log('✅ WhatsApp client is ready and connected!');
  });

  client.on('authenticated', () => {
    clientStatus = 'loading';
    console.log('WhatsApp authenticated successfully.');
  });

  client.on('auth_failure', (msg) => {
    clientStatus = 'disconnected';
    qrCodeData = '';
    console.error('WhatsApp authentication failure:', msg);
  });

  client.on('disconnected', (reason) => {
    clientStatus = 'disconnected';
    qrCodeData = '';
    console.log('WhatsApp client was disconnected:', reason);
    // Attempt re-init
    setTimeout(() => {
      try { client.initialize(); } catch(e){}
    }, 5000);
  });

  // Capture all messages (incoming & outgoing) created on this account
  client.on('message_create', (msg) => {
    // Resolve the target phone number depending on whether the message is outgoing (to) or incoming (from)
    const targetJid = msg.fromMe ? msg.to : msg.from;
    const phone = getCleanPhoneFromJid(targetJid);
    if (!phone) return;

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
    console.error("Failed to initialize WhatsApp client:", err);
    clientStatus = 'disconnected';
  });
}

export function getWhatsAppStatus() {
  return {
    status: clientStatus,
    qr: qrCodeData
  };
}

export async function sendWhatsAppMessage(phone, text) {
  if (clientStatus !== 'ready') {
    throw new Error('WhatsApp client is not connected.');
  }

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  
  const whatsappId = `${cleanPhone}@c.us`;
  await client.sendMessage(whatsappId, text);
  return { success: true };
}

export async function sendWhatsAppMedia(phone, filePath, caption) {
  if (clientStatus !== 'ready') {
    throw new Error('WhatsApp client is not connected.');
  }

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  
  const whatsappId = `${cleanPhone}@c.us`;
  const media = MessageMedia.fromFilePath(filePath);
  // Send media with the provided caption (message text or filename fallback)
  await client.sendMessage(whatsappId, media, { caption: caption || '' });
  return { success: true };
}

// Fetch real chat history from WhatsApp Web for a given phone number
export async function fetchChatHistory(phone) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
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
    const rawPhone = phone.replace(/\D/g, '');
    const key = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    return (messageStore[key] || []).filter(msg => msg.timestamp >= limit);
  }
}

// Get only in-memory messages (for polling new incoming, limited to 24 hours)
export function getStoredMessages(phone) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  const now = Math.floor(Date.now() / 1000);
  const limit = now - 24 * 60 * 60;
  return (messageStore[cleanPhone] || []).filter(m => m.timestamp >= limit);
}
