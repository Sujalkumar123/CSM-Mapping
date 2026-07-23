import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import https from 'https';
import multer from 'multer';
import { initWhatsApp, getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppMedia, fetchChatHistory, getStoredMessages } from './whatsapp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Multer Upload Configuration ───
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// ─── Environment Variables Loader ───
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value;
        }
      }
    });
    console.log("Loaded environment variables from .env");
  }
} catch (error) {
  console.error("Failed to load .env file:", error);
}

// ─── Slack API Helpers ───
function slackApiCall(token, endpoint, params = {}, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const query = method === 'GET' && Object.entries(params).length > 0
      ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    
    const options = {
      hostname: 'slack.com',
      path: `/api/${endpoint}${query}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            console.warn(`[Slack API Error] Endpoint: ${endpoint}`);
            console.warn(`- Error: ${parsed.error}`);
            console.warn(`- Token Scopes (x-oauth-scopes): ${res.headers['x-oauth-scopes'] || 'None'}`);
            console.warn(`- Required Scopes (x-accepted-oauth-scopes): ${res.headers['x-accepted-oauth-scopes'] || 'None'}`);
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse Slack response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (err) => { reject(err); });
    
    if (body && method === 'POST') {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function fetchSlackUsers(token) {
  let users = [];
  let cursor = '';
  
  do {
    const params = { limit: 1000 };
    if (cursor) params.cursor = cursor;
    
    const data = await slackApiCall(token, 'users.list', params);
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
    
    if (data.members) {
      users = users.concat(data.members);
    }
    
    cursor = data.response_metadata?.next_cursor || '';
  } while (cursor);
  
  return users;
}

function readSlackMembersCsv() {
  const csvPath = path.join(__dirname, '..', '..', 'slack_members.csv');
  if (!fs.existsSync(csvPath)) return [];
  
  try {
    let content = fs.readFileSync(csvPath, 'binary');
    if (content.charCodeAt(0) === 0xFF && content.charCodeAt(1) === 0xFE) {
      content = fs.readFileSync(csvPath, 'utf16le');
    } else {
      content = fs.readFileSync(csvPath, 'utf8');
    }
    
    const lines = content.split(/\r?\n/);
    const members = [];
    
    lines.forEach((line, idx) => {
      if (idx === 0 || !line.trim()) return;
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts.length >= 3) {
        const name = parts[0].replace(/"/g, '').trim();
        const email = parts[1].replace(/"/g, '').trim();
        const id = parts[2].replace(/"/g, '').trim();
        members.push({
          id,
          real_name: name,
          profile: { email }
        });
      }
    });
    
    return members;
  } catch (error) {
    console.error("Error reading slack_members.csv:", error);
    return [];
  }
}

async function syncSlackIds(token) {
  let members = [];
  let isFallback = false;
  
  if (token) {
    try {
      members = await fetchSlackUsers(token);
    } catch (apiError) {
      console.warn("Slack API failed. Falling back to local slack_members.csv:", apiError.message);
      members = readSlackMembersCsv();
      isFallback = true;
    }
  } else {
    members = readSlackMembersCsv();
    isFallback = true;
  }
  
  if (members.length === 0) {
    if (isFallback) {
      throw new Error("Could not fetch users from Slack API, and local slack_members.csv is missing or empty.");
    } else {
      throw new Error("No members returned from Slack API.");
    }
  }
  
  const emailMap = new Map();
  const nameMap = new Map();
  
  function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  
  members.forEach(m => {
    if (m.deleted || m.is_bot || m.id === 'USLACKBOT') return;
    
    const email = m.profile?.email;
    if (email) {
      emailMap.set(email.toLowerCase().trim(), m.id);
    }
    
    const realName = m.real_name || m.profile?.real_name;
    if (realName) {
      nameMap.set(normalizeName(realName), m.id);
    }
    
    const displayName = m.profile?.display_name;
    if (displayName) {
      nameMap.set(normalizeName(displayName), m.id);
    }
    
    const name = m.name;
    if (name) {
      nameMap.set(normalizeName(name), m.id);
    }
  });
  
  const clients = readExcelData();
  let updatedCount = 0;
  
  clients.forEach(c => {
    // Sync CSM 1
    if (c.csm1?.name) {
      let matchedId = '';
      if (c.csm1.email) {
        matchedId = emailMap.get(c.csm1.email.toLowerCase().trim());
      }
      if (!matchedId) {
        matchedId = nameMap.get(normalizeName(c.csm1.name));
      }
      if (matchedId && c.csm1.slack !== matchedId) {
        c.csm1.slack = matchedId;
        updatedCount++;
      }
    }
    
    // Sync CSM 2
    if (c.csm2?.name) {
      let matchedId = '';
      if (c.csm2.email) {
        matchedId = emailMap.get(c.csm2.email.toLowerCase().trim());
      }
      if (!matchedId) {
        matchedId = nameMap.get(normalizeName(c.csm2.name));
      }
      if (matchedId && c.csm2.slack !== matchedId) {
        c.csm2.slack = matchedId;
        updatedCount++;
      }
    }
  });
  
  if (updatedCount > 0) {
    writeExcelData(clients);
  }
  
  return {
    totalSlackUsers: members.length,
    updatedCount,
    clients,
    isFallback
  };
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsPath));

// Serve static files from the React frontend build
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendBuildPath));


// Target excel filepath (goes up to workspace root)
const EXCEL_PATH = path.join(__dirname, '..', '..', 'csm_company_mappings (14).xlsx');

const cleanColumns = [
  "id", "legalName", "aliasBrand", "product", 
  "csm_name_1", "csm_contact_1", "csm_email_1", 
  "csm_name_2", "csm_email_2", "csm_contact_2", 
  "lead_name", "lead_contact", "lead_email",
  "csm_slack_1", "csm_slack_2"
];

let clientsCache = null;

// Read and clean Excel data (with in-memory caching)
function readExcelData(forceReload = false) {
  if (clientsCache && !forceReload) {
    return clientsCache;
  }

  if (!fs.existsSync(EXCEL_PATH)) {
    clientsCache = [];
    return clientsCache;
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Get raw JSON rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length === 0) {
    clientsCache = [];
    return clientsCache;
  }

  // Remove header row
  const headers = rawRows[0];
  const rows = rawRows.slice(1);

  clientsCache = rows.map(row => {
    const item = {};
    cleanColumns.forEach((col, index) => {
      let val = row[index];
      if (val === undefined || val === null) {
        val = '';
      }
      val = String(val).trim();
      
      // Clean float format like "9876543210.0"
      if (val.replace('.', '', 1).match(/^\d+$/)) {
        val = val.replace(/\.0+$/, '');
      }

      // Clean default placeholders
      if (val === '0' || val === '1') {
        val = '';
      }

      item[col] = val;
    });

    // Map to frontend nested schema structure
    return {
      id: item.id || '',
      legalName: item.legalName || '',
      product: item.product || '',
      csm1: {
        name: item.csm_name_1 || '',
        email: item.csm_email_1 || '',
        phone: item.csm_contact_1 || '',
        slack: item.csm_slack_1 || ''
      },
      csm2: {
        name: item.csm_name_2 || '',
        email: item.csm_email_2 || '',
        phone: item.csm_contact_2 || '',
        slack: item.csm_slack_2 || ''
      },
      lead: {
        name: item.lead_name || '',
        email: item.lead_email || '',
        phone: item.lead_contact || ''
      }
    };
  });

  return clientsCache;
}

// Write React schema items back to Excel and update cache
function writeExcelData(clients) {
  clientsCache = clients;
  const originalHeaders = [
    "id", "legalName", "aliasBrand", "product", 
    "CSM Name 1", "CSM Contact", "CSM EmailId", 
    "CSM Name 2", "CSM EmailID", "CSM Contact", 
    "leadName", "leadName Contact", "lead EmailID",
    "CSM Slack ID", "CSM 2 Slack ID"
  ];

  const sheetData = [originalHeaders];

  clients.forEach(c => {
    const row = [
      c.id || '',
      c.legalName || '',
      '', // aliasBrand
      c.product || '',
      c.csm1?.name || '',
      c.csm1?.phone || '',
      c.csm1?.email || '',
      c.csm2?.name || '',
      c.csm2?.email || '',
      c.csm2?.phone || '',
      c.lead?.name || '',
      c.lead?.phone || '',
      c.lead?.email || '',
      c.csm1?.slack || '',
      c.csm2?.slack || ''
    ];
    sheetData.push(row);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mappings');
  XLSX.writeFile(workbook, EXCEL_PATH);
}

// ─── APIs ───

// 1. Get all mappings
app.get('/api/clients', (req, res) => {
  try {
    const data = readExcelData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add assignment
app.post('/api/clients', (req, res) => {
  try {
    const newClient = req.body;
    const currentList = readExcelData();
    
    // Auto increment ID if not present
    if (!newClient.id) {
      const ids = currentList.map(c => parseInt(c.id)).filter(id => !isNaN(id));
      const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1001;
      newClient.id = String(nextId);
    }

    currentList.push(newClient);
    writeExcelData(currentList);
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update assignment
app.put('/api/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updatedClient = req.body;
    let currentList = readExcelData();
    
    let index = currentList.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }

    currentList[index] = { ...currentList[index], ...updatedClient };
    writeExcelData(currentList);
    res.json(currentList[index]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete assignment
app.delete('/api/clients/:id', (req, res) => {
  try {
    const { id } = req.params;
    let currentList = readExcelData();
    
    let index = currentList.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }

    currentList.splice(index, 1);
    writeExcelData(currentList);
    res.json({ success: true, message: `Record ${id} removed` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Check Slack integration status
app.get('/api/slack/status', async (req, res) => {
  try {
    const token = process.env.SLACK_API_TOKEN;
    if (!token) {
      return res.json({ configured: false });
    }
    
    const data = await slackApiCall(token, 'auth.test');
    if (!data.ok) {
      return res.json({ configured: true, valid: false, error: data.error });
    }
    
    res.json({
      configured: true,
      valid: true,
      team: data.team,
      user: data.user,
      team_id: data.team_id,
      user_id: data.user_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Update Slack config
app.post('/api/slack/config', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    
    // First validate the new token
    const testData = await slackApiCall(token, 'auth.test');
    if (!testData.ok) {
      return res.status(400).json({ error: `Invalid token: ${testData.error}` });
    }
    
    process.env.SLACK_API_TOKEN = token;
    
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, `SLACK_API_TOKEN=${token}\n`, 'utf8');
    
    res.json({
      success: true,
      team: testData.team,
      user: testData.user,
      team_id: testData.team_id,
      user_id: testData.user_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Sync Slack member IDs
app.post('/api/slack/sync', async (req, res) => {
  try {
    const token = process.env.SLACK_API_TOKEN;
    const result = await syncSlackIds(token);
    res.json({
      success: true,
      updatedCount: result.updatedCount,
      totalSlackUsers: result.totalSlackUsers,
      isFallback: result.isFallback,
      data: result.clients
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Send Slack Direct Messages
app.post('/api/slack/send-dm', async (req, res) => {
  try {
    const token = process.env.SLACK_API_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'No Slack token configured. Please configure it first.' });
    }
    
    const { recipients, message, files } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list is empty or invalid.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message body is required.' });
    }
    
    let fullText = message;
    if (files && Array.isArray(files) && files.length > 0) {
      fullText += '\n\n*Attachments:*';
      files.forEach(f => {
        fullText += `\n• <${f.url}|${f.filename}>`;
      });
    }
    
    const results = [];
    
    for (const rec of recipients) {
      if (!rec.slackId) {
        results.push({ name: rec.name, success: false, error: 'No Slack ID' });
        continue;
      }
      
      try {
        // Open DM
        const openRes = await slackApiCall(token, 'conversations.open', {}, 'POST', { users: rec.slackId });
        if (!openRes.ok) {
          throw new Error(`conversations.open: ${openRes.error}`);
        }
        
        const channelId = openRes.channel.id;
        
        // Post message
        const postRes = await slackApiCall(token, 'chat.postMessage', {}, 'POST', {
          channel: channelId,
          text: fullText
        });
        
        if (!postRes.ok) {
          throw new Error(`chat.postMessage: ${postRes.error}`);
        }
        
        results.push({ name: rec.name, success: true });
      } catch (err) {
        console.error(`Error sending Slack DM to ${rec.name}:`, err.message);
        results.push({ name: rec.name, success: false, error: err.message });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Upload broadcast file attachments
app.post('/api/attachments/upload', upload.array('files'), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json({ success: true, files: [] });
    }
    
    const host = req.headers.host || `localhost:5001`;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    
    const files = req.files.map(f => ({
      filename: f.originalname,
      path: f.path,
      mimetype: f.mimetype,
      url: `${protocol}://${host}/uploads/${f.filename}`
    }));
    
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Get WhatsApp connection status
app.get('/api/whatsapp/status', (req, res) => {
  try {
    const statusData = getWhatsAppStatus();
    res.json(statusData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10a. Fetch chat history for a phone number
app.get('/api/whatsapp/chat/:phone', async (req, res) => {
  try {
    const messages = await fetchChatHistory(req.params.phone);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10b. Poll for new stored messages (lightweight, no WhatsApp API call)
app.get('/api/whatsapp/messages/:phone', (req, res) => {
  try {
    const messages = getStoredMessages(req.params.phone);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10c. Send a single message to one person
app.post('/api/whatsapp/send-single', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
    const result = await sendWhatsAppMessage(phone, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Send WhatsApp direct messages in background (with optional native files)
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { recipients, message, files } = req.body;
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list is empty or invalid.' });
    }
    if (!message) {
      return res.status(400).json({ error: 'Message body is required.' });
    }
    
    // Check if client is ready
    const statusData = getWhatsAppStatus();
    if (statusData.status !== 'ready') {
      return res.status(400).json({ error: 'WhatsApp is not integrated. Please scan the QR code to authenticate first.' });
    }
    
    const results = [];
    
    for (const rec of recipients) {
      if (!rec.phone) {
        results.push({ name: rec.name, success: false, error: 'No phone number' });
        continue;
      }
      
      try {
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        const images = (files || []).filter(f => imageTypes.includes(f.mimetype));
        const docs = (files || []).filter(f => !imageTypes.includes(f.mimetype));

        if (images.length === 0 && docs.length === 0) {
          // No files — send plain text only
          const sendResult = await sendWhatsAppMessage(rec.phone, message);
          if (!sendResult.success) throw new Error(sendResult.error);
        } else {
          // Send images with message text as caption
          for (let i = 0; i < images.length; i++) {
            const caption = i === 0 && docs.length === 0 ? message : (i === 0 ? message : '');
            const r = await sendWhatsAppMedia(rec.phone, images[i].path, caption);
            if (!r.success) throw new Error(r.error);
          }

          // If there are docs, send message text first (if no images already sent the text)
          if (docs.length > 0) {
            if (images.length === 0) {
              // No images — send text first so recipient sees message + document separately
              const sendResult = await sendWhatsAppMessage(rec.phone, message);
              if (!sendResult.success) throw new Error(sendResult.error);
            }
            // Send each document with its own filename as caption
            for (const doc of docs) {
              const r = await sendWhatsAppMedia(rec.phone, doc.path, doc.filename);
              if (!r.success) throw new Error(`Doc upload failed: ${r.error}`);
            }
          }
        }

        results.push({ name: rec.name, success: true });
      } catch (err) {
        console.error(`Error sending WhatsApp background message to ${rec.name}:`, err.message);
        results.push({ name: rec.name, success: false, error: err.message });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// For any other request, send the React index.html (SPA routing fallback)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexHtml = path.join(frontendBuildPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send("React frontend build not found. Please build the frontend first.");
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  // Warm up clients data cache immediately on server start
  const initialData = readExcelData(true);
  console.log(`Cached ${initialData.length} client records in memory.`);
  
  // Defer heavy WhatsApp background initialization so Express handles incoming HTTP requests immediately
  setTimeout(() => {
    initWhatsApp();
  }, 1000);
});
