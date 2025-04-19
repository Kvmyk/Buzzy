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
const ACTIVATION_WEBHOOK_URL = 'https://n8nlink.bieda.it/webhook-test/c4fa58af-d8d4-4930-9003-4c10711064e2';

// ——— Middleware ———
app.use(cookieParser());
app.use(express.static('./'));
app.use(express.json()); // parsowanie JSON dla POST /activate

// ——— Pomocnicze funkcje ———
function generateRandomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// ——— Routes ———
// Strona główna, serwuje index.html
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

// Krok 2: Callback z Spotify, zwraca token do front-end
app.get('/callback', async (req, res) => {
  const code  = req.query.code  || null;
  const state = req.query.state || null;
  const storedState = req.cookies['spotify_auth_state'] || null;

  if (!code) return res.redirect('/?error=missing_code');
  if (state !== storedState) return res.redirect('/?error=state_mismatch');
  res.clearCookie('spotify_auth_state');

  // Przygotuj body
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

    const { access_token } = tokenRes.data;

    // Przekieruj do frontendu z tokenem, bez wywoływania webhooka
    res.redirect(`https://buzzy.bieda.it?token=${access_token}`);
  } catch (err) {
    console.error('Token request failed:', err.response?.status, err.response?.data || err.message);
    res.redirect('/?error=token_request_failed');
  }
});

// POST /activate - wysyła token do jednego webhooka po kliknięciu przycisku
app.post('/activate', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'missing_token' });
  }

  try {
    // Waliduj token (opcjonalnie)
    await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Forward do n8n Webhook Activation URL
    const webhookRes = await axios.post(
      ACTIVATION_WEBHOOK_URL,
      { token }
    );

    return res.json({ status: 'activated', data: webhookRes.data });
  } catch (err) {
    console.error('Activation failed:', err.response?.status, err.response?.data || err.message);
    return res.status(401).json({ error: 'invalid_token' });
  }
});

// Start serwera
app.listen(PORT, IP_ADDRESS, () => {
  console.log(`Buzzy app listening on http://[${IP_ADDRESS}]:${PORT}`);
});
