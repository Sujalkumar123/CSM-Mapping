import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple env loader
let token = process.env.SLACK_API_TOKEN;
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
          if (key === 'SLACK_API_TOKEN') token = value;
        }
      }
    });
  }
} catch (e) {
  console.error("Error reading .env:", e);
}

if (!token) {
  console.error("❌ Error: No SLACK_API_TOKEN found in .env or environment.");
  process.exit(1);
}

console.log(`Testing token: ${token.substring(0, 15)}...`);

const options = {
  hostname: 'slack.com',
  path: '/api/auth.test',
  method: 'POST',
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
      const result = JSON.parse(data);
      if (result.ok) {
        console.log("\n✅ Success! The Slack token is working.");
        console.log(`- Workspace (Team): ${result.team} (${result.team_id})`);
        console.log(`- User: ${result.user} (${result.user_id})`);
        console.log(`- API URL: ${result.url}`);
      } else {
        console.log(`\n❌ API Key Failed: ${result.error}`);
        if (result.error === 'invalid_auth') {
          console.log("Details: The token is invalid, expired, or has been revoked by Slack.");
        }
      }
    } catch (e) {
      console.error("❌ Failed to parse response:", e.message);
    }
  });
});

req.on('error', (err) => {
  console.error("❌ Request Error:", err.message);
});

req.end();
