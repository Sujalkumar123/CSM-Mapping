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
      '--disable-gpu'
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

export async function sendWhatsAppMedia(phone, filePath, filename) {
  if (clientStatus !== 'ready') {
    throw new Error('WhatsApp client is not connected.');
  }

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  
  const whatsappId = `${cleanPhone}@c.us`;
  const media = MessageMedia.fromFilePath(filePath);
  await client.sendMessage(whatsappId, media, { caption: filename });
  return { success: true };
}
