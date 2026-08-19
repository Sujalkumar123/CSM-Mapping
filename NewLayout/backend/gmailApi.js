import MailComposer from 'nodemailer/lib/mail-composer/index.js';

// Render blocks outbound SMTP (ports 25/465/587) on free web services, so
// nodemailer's transport can never connect. The Gmail REST API runs over
// plain HTTPS on 443, which isn't blocked, and sends as the real signed-in
// account — so replies, threading and deliverability behave exactly as if
// the mail had gone out through Gmail itself.
//
// Reading mail still goes over IMAP (port 993, also unblocked) — this only
// replaces the sending half.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

export function isGmailApiConfigured() {
  return !!(process.env.GMAIL_CLIENT_ID
    && process.env.GMAIL_CLIENT_SECRET
    && process.env.GMAIL_REFRESH_TOKEN);
}

// Access tokens last about an hour; refreshing on every send would add a
// pointless round trip to Google before each message.
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Gmail authorization failed: ${detail}`);
  }

  cachedToken = data.access_token;
  // Refresh a minute early rather than racing the expiry
  cachedTokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

// Reuses nodemailer's own MIME builder, so attachments, cc/bcc and the
// In-Reply-To/References threading headers are produced exactly as they
// were over SMTP — only the delivery mechanism changes.
function buildRawMessage(message) {
  return new Promise((resolve, reject) => {
    // keepBcc is essential here. MailComposer strips Bcc from the MIME by
    // default, which is right for SMTP — nodemailer passes those addresses
    // separately in the SMTP envelope, so they still get delivered without
    // appearing in the headers. The Gmail API has no envelope: it derives
    // recipients from the MIME alone, so dropping Bcc would mean broadcasts
    // (the Bulk Message Center sends entirely via Bcc) silently reach nobody.
    const compiled = new MailComposer(message).compile();
    compiled.keepBcc = true; // set on the compiled node, as nodemailer's own sendmail/stream transports do
    compiled.build((err, msg) => {
      if (err) reject(err);
      else resolve(msg);
    });
  });
}

function toBase64Url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendViaGmailApi(message, threadId) {
  const accessToken = await getAccessToken();
  const raw = toBase64Url(await buildRawMessage(message));

  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(threadId ? { raw, threadId } : { raw })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error?.message || `HTTP ${res.status}`;
    throw new Error(`Gmail API send failed: ${detail}`);
  }

  return { id: data.id, threadId: data.threadId };
}
