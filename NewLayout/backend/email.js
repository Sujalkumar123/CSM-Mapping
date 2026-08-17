import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { convert as htmlToText } from 'html-to-text';
import { cached, invalidate } from './cache.js';

const IMAP_HOST = 'imap.gmail.com';
const SMTP_HOST = 'smtp.gmail.com';

function getCreds() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, pass };
}

// Same principle as the WhatsApp roster whitelist: this mailbox is your real
// inbox, but the "everyone" overview should only ever surface mail tied to
// a CSM — not the other 450+ people at the company who happen to email you.
let rosterEmails = new Set();

export function setRosterEmails(emails) {
  rosterEmails = new Set((emails || []).map(e => String(e || '').toLowerCase().trim()).filter(Boolean));
}

function isRosterEmail(address) {
  return rosterEmails.has(String(address || '').toLowerCase().trim());
}

export function getEmailStatus() {
  const creds = getCreds();
  if (!creds) return { configured: false };
  return { configured: true, user: creds.user };
}

// One long-lived IMAP connection. Reconnecting per request cost a full TLS
// handshake + LOGIN + mailbox open, which dominated every inbox load.
let shared = null;
let connecting = null;

async function getClient(creds) {
  if (shared?.usable) return shared;
  if (connecting) return connecting;

  connecting = (async () => {
    const client = new ImapFlow({
      host: IMAP_HOST,
      port: 993,
      secure: true,
      auth: { user: creds.user, pass: creds.pass },
      logger: false,
      emitLogs: false
    });
    client.on('error', () => { shared = null; });
    client.on('close', () => { shared = null; });
    await client.connect();
    shared = client;
    return client;
  })().finally(() => { connecting = null; });

  return connecting;
}

export function resetEmailConnection() {
  const old = shared;
  shared = null;
  old?.logout().catch(() => {});
}

async function withImap(fn) {
  const creds = getCreds();
  if (!creds) throw new Error('Email is not configured.');

  try {
    const client = await getClient(creds);
    return await fn(client, creds);
  } catch (err) {
    // A dropped socket poisons the cached client — clear it and try once more
    shared = null;
    const client = await getClient(creds);
    return await fn(client, creds);
  }
}

export async function verifyEmailCreds(user, pass) {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false
  });
  await client.connect();
  await client.logout().catch(() => {});
  return true;
}

// Prefer the HTML part over the auto-generated plain-text part. Gmail's own
// plain-text fallback for templated mail (security alerts, notifications)
// often prints raw tracking query strings as visible text — the HTML part,
// properly converted, gives the same body a real client would show.
async function decodeBody(source) {
  if (!source) return { body: '', snippet: '' };
  try {
    const parsed = await simpleParser(source, { skipImageLinks: true });
    const text = parsed.html
      ? htmlToText(parsed.html, {
          wordwrap: false,
          selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' }
          ]
        })
      : (parsed.text || '');

    const body = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 4000);

    const snippet = body.replace(/\s+/g, ' ').slice(0, 140);
    return { body, snippet };
  } catch (e) {
    return { body: '(could not read message body)', snippet: '' };
  }
}

// "All Mail" is localised, so fall back to whichever archive box this account
// exposes. The folder list never changes in practice, so resolve it once.
function resolveMailbox(client) {
  return cached('imap:mailbox', 6 * 60 * 60 * 1000, async () => {
    const boxes = await client.list();
    const all = boxes.find(b => b.specialUse === '\\All');
    return all?.path || 'INBOX';
  });
}

// Fetch the most recent messages exchanged with one address, newest last.
export function fetchEmailThread(address, limit = 40) {
  if (!address) throw new Error('Email address is required.');
  // Cache key includes the limit — a 40-message load and a 200-message
  // "load full history" pull are different results, not the same one
  return cached(`email:${address.toLowerCase()}:${limit}`, 60 * 1000, () => loadThread(address, limit));
}

// Pull and parse a set of message UIDs from an already-open mailbox lock.
async function loadMessages(client, creds, uids, limit) {
  let raw = [];
  for await (const msg of client.fetch(
    uids.slice(-limit),
    { uid: true, envelope: true, source: true },
    { uid: true }
  )) {
    raw.push({ uid: msg.uid, envelope: msg.envelope, source: msg.source });
  }

  const messages = await Promise.all(raw.map(async r => {
    const from = r.envelope?.from?.[0]?.address || '';
    const to = (r.envelope?.to || []).map(t => t.address).filter(Boolean);
    const { body, snippet } = await decodeBody(r.source);
    return {
      id: String(r.uid),
      subject: r.envelope?.subject || '(no subject)',
      from,
      fromName: r.envelope?.from?.[0]?.name || from,
      to,
      date: r.envelope?.date ? new Date(r.envelope.date).getTime() : Date.now(),
      fromMe: from.toLowerCase() === creds.user.toLowerCase(),
      body,
      snippet,
      messageId: r.envelope?.messageId || ''
    };
  }));

  return messages.sort((a, b) => a.date - b.date);
}

// The merged "everyone" view for the Inbox landing screen — one bounded
// scan of the mailbox, filtered to mail touching a roster address, instead
// of a per-CSM IMAP search fanned out across 80+ people on every load.
export function fetchRosterMail(limit = 60) {
  return cached(`email:roster:${limit}`, 45 * 1000, () => loadRosterMail(limit));
}

function loadRosterMail(limit) {
  return withImap(async (client, creds) => {
    const mailbox = await resolveMailbox(client);
    const lock = await client.getMailboxLock(mailbox);

    try {
      const uids = await client.search({ all: true }, { uid: true });
      if (!uids || uids.length === 0) return [];

      // Scan a bounded recent window, then keep only roster-relevant mail —
      // scanning the whole mailbox to find a handful of CSM threads doesn't scale
      const scanWindow = Math.min(uids.length, Math.max(limit * 4, 200));
      const messages = await loadMessages(client, creds, uids, scanWindow);

      return messages
        .filter(m => isRosterEmail(m.from) || m.to.some(isRosterEmail))
        .slice(-limit);
    } finally {
      lock.release();
    }
  });
}

function loadThread(address, limit) {
  return withImap(async (client, creds) => {
    const mailbox = await resolveMailbox(client);
    const lock = await client.getMailboxLock(mailbox);

    try {
      const uids = await client.search({
        or: [{ from: address }, { to: address }]
      }, { uid: true });

      if (uids && uids.length > 0) {
        return { messages: await loadMessages(client, creds, uids, limit), matched: true };
      }

      // Nobody has emailed this address yet — fall back to the general
      // inbox so the panel never sits blank, flagged so the UI can say so
      const inboxUids = await client.search({ all: true }, { uid: true });
      const messages = inboxUids && inboxUids.length > 0
        ? await loadMessages(client, creds, inboxUids, Math.min(limit, 20))
        : [];
      return { messages, matched: false };
    } finally {
      lock.release();
    }
  });
}

let transport = null;

function getTransport(creds) {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 2,
    auth: { user: creds.user, pass: creds.pass }
  });
  return transport;
}

export function resetEmailTransport() {
  transport?.close();
  transport = null;
}

const asList = (v) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(s => String(s).trim())
  .filter(Boolean);

// Case-insensitive de-dupe that keeps the first spelling seen
function uniqueAddresses(list) {
  const seen = new Set();
  const out = [];
  for (const addr of list) {
    const k = addr.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(addr);
  }
  return out;
}

export async function sendEmail({ to, cc, bcc, subject, body, inReplyTo, attachments }) {
  const creds = getCreds();
  if (!creds) throw new Error('Email is not configured.');

  const toList = uniqueAddresses(asList(to));
  const ccList = uniqueAddresses(asList(cc));
  // An address already in To/Cc must not be silently re-sent via Bcc
  const addressed = new Set([...toList, ...ccList].map(a => a.toLowerCase()));
  const bccList = uniqueAddresses(asList(bcc)).filter(a => !addressed.has(a.toLowerCase()));

  if (toList.length === 0 && bccList.length === 0) {
    throw new Error('At least one recipient is required.');
  }

  const transporter = getTransport(creds);

  const headers = {};
  if (inReplyTo) {
    headers['In-Reply-To'] = inReplyTo;
    headers['References'] = inReplyTo;
  }

  const info = await transporter.sendMail({
    from: creds.user,
    // Bcc-only broadcasts still need a To header; address it to the sender
    to: toList.length > 0 ? toList : creds.user,
    cc: ccList.length > 0 ? ccList : undefined,
    bcc: bccList.length > 0 ? bccList : undefined,
    subject: subject || '(no subject)',
    text: body,
    headers,
    // Real MIME attachments, read from the paths multer wrote to disk
    attachments: (attachments || [])
      .filter(f => f && f.path)
      .map(f => ({ filename: f.filename, path: f.path, contentType: f.mimetype }))
  });

  // Any thread we just wrote into is now stale
  for (const addr of [...toList, ...ccList, ...bccList]) {
    invalidate(`email:${addr.toLowerCase()}`);
  }

  return {
    success: true,
    messageId: info.messageId,
    recipients: toList.length + ccList.length + bccList.length
  };
}
