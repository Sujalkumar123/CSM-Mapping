// One-time setup helper: exchanges a Google OAuth client for the long-lived
// refresh token the backend needs to send mail through the Gmail API.
//
//   node getGmailToken.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// Opens a local callback server, prints a URL to approve in the browser, and
// prints the refresh token when Google redirects back. Run it once — the
// refresh token doesn't expire unless it's revoked or unused for six months.

import http from 'http';

const [clientId, clientSecret] = process.argv.slice(2);

if (!clientId || !clientSecret) {
  console.error('Usage: node getGmailToken.mjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/gmail.send';

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  // offline + consent together are what actually guarantee a refresh token
  access_type: 'offline',
  prompt: 'consent'
});

console.log('\nOpen this URL in your browser and approve access:\n');
console.log(authUrl);
console.log('\nWaiting for the redirect back...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.end(`Authorization failed: ${error}. You can close this tab.`);
    console.error('Authorization failed:', error);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.end('Waiting for the authorization code...');
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      res.end('Token exchange failed. Check the terminal.');
      console.error('Token exchange failed:', data.error_description || data.error || data);
      console.error('\nIf it says the token was already granted, revoke this app at');
      console.error('https://myaccount.google.com/permissions and run this again.');
      server.close();
      process.exit(1);
    }

    res.end('Done. You can close this tab and return to the terminal.');
    console.log('GMAIL_REFRESH_TOKEN=' + data.refresh_token);
    console.log('\nCopy that value back to whoever is wiring up the backend.\n');
    server.close();
    process.exit(0);
  } catch (e) {
    res.end('Token exchange errored. Check the terminal.');
    console.error('Token exchange errored:', e.message);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
