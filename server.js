const express = require('express');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

const app = express();

// ——— Ustawienia ———
const PORT = process.env.PORT || 3000;
const IP_ADDRESS = '2a01:4f9:2b:289c::130';
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'https://buzzy.bieda.it/callback';

// ——— Middleware ———
app.use(cookieParser());
app.use(express.static('./'));
app.use(express.json()); // parsowanie JSON dla przychodzących POST

// ——— Pomocnicze funkcje ———
function generateRandomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

async function sendToWebhook(url, payload) {
  try {
    const res = await axios.post(url, payload);
    console.log(`Webhook POST ${url} OK:`, res.status);
    return res.data;
  } catch (err) {
    console.error(`Webhook POST ${url} error:`, err.response?.status, err.response?.data || err.message);
    throw err;
  }
}

// ——— Routes ———
// Strona główna
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Krok 1: Przekierowanie do Spotify
app.get('/login', (req, res) => {
  const state = generateRandomString();
  res.cookie('spotify_auth_state', state, { httpOnly: true });
  const scope = [
    'user-read-private',
    'user-read-email',
    'playlist-modify-private',
    'playlist-modify-public'
  ].join(' ');

  const params = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
    state
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// Krok 2: Callback z Spotify
app.get('/callback', async (req, res) => {
  const code  = req.query.code  || null;
  const state = req.query.state || null;
  const storedState = req.cookies['spotify_auth_state'] || null;

  if (!code) return res.redirect('/?error=missing_code');
  if (state !== storedState) return res.redirect('/?error=state_mismatch');
  res.clearCookie('spotify_auth_state');

  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: REDIRECT_URI
  });

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      body.toString(),
      { headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }}
    );

    const { access_token, refresh_token } = tokenRes.data;

    // Wyślij tokeny do n8n (autoryzacja)
    await sendToWebhook(
      'https://n8nlink.bieda.it/webhook-test/778fa366-b202-4fc6-b763-e0619b1655b4',
      { access_token, refresh_token }
    );

    // Przekieruj do frontendu z tokenem
    res.redirect(`https://buzzy.bieda.it?token=${access_token}`);
  } catch (err) {
    console.error('Token request failed:', err.response?.status, err.response?.data || err.message);
    res.redirect('/?error=token_request_failed');
  }
});

// Nowa trasa: obsługa uruchomienia aplikacji
app.post('/webhook/waitForActivation', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'missing_token' });

  try {
    // Walidacja tokena przez pobranie danych użytkownika
    const meRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Jeśli OK, forward do n8n Activation webhook
    const activationData = await sendToWebhook(
      'https://n8nlink.bieda.it/webhook-activation/your-activation-id',
      { token, user: meRes.data }
    );

    return res.json({ status: 'activated', activationData });
  } catch (err) {
    console.error('Activation failed:', err.response?.status, err.response?.data || err.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
});

// Opcjonalne: odświeżanie tokena
app.get('/refresh_token', async (req, res) => {
  const { refresh_token } = req.query;
  if (!refresh_token) return res.status(400).json({ error: 'missing_refresh_token' });

  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token });
  try {
    const refreshRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      body.toString(),
      { headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }}
    );
    return res.json(refreshRes.data);
  } catch (err) {
    console.error('Refresh token error:', err.response?.status, err.response?.data || err.message);
    return res.status(500).json({ error: 'refresh_failed' });
  }
});

// Start serwera
app.listen(PORT, IP_ADDRESS, () => {
  console.log(`Buzzy app listening on http://[${IP_ADDRESS}]:${PORT}`);
});
