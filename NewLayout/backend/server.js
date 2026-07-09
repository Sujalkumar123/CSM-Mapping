import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

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

// Read and clean Excel data
function readExcelData() {
  if (!fs.existsSync(EXCEL_PATH)) {
    return [];
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Get raw JSON rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (rawRows.length === 0) return [];

  // Remove header row
  const headers = rawRows[0];
  const rows = rawRows.slice(1);

  return rows.map(row => {
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
}

// Write React schema items back to Excel
function writeExcelData(clients) {
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
});
