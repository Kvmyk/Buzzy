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

// ——— Pomocnicze funkcje ———
// Generator CSRF state
function generateRandomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Zapisz tokeny w cookies
function saveTokensInCookies(res, payload) {
  try {
    // Zapisz tokeny w cookies - definiujemy opcje cookies
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dni
    };
    
    // Zapisz tokeny
    res.cookie('spotify_access_token', payload.access_token, cookieOptions);
    res.cookie('spotify_refresh_token', payload.refresh_token, cookieOptions);
    
    console.log('Tokens saved in cookies');
  } catch (err) {
    console.error('Error saving tokens:', err.message);
  }
}

// Wysyłka do webhooka (obsługuje tokeny)
async function sendToWebhook(payload) {
  try {
    const url = 'https://n8nlink.bieda.it/webhook-test/778fa366-b202-4fc6-b763-e0619b1655b4';
    const res = await axios.post(url, {
      ...payload,
      timestamp: new Date().toISOString(),
      source: 'buzzy.bieda.it'
    });
    console.log('Webhook OK:', res.status);
  } catch (err) {
    console.error('Webhook error:', err.response?.status, err.response?.data || err.message);
  }
}

// ——— Routes ———

// Strona główna
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Krok 1: Przekierowanie do Spotify
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

// Krok 2: Callback z Spotify
app.get('/callback', async (req, res) => {
  const code  = req.query.code  || null;
  const state = req.query.state || null;
  const storedState = req.cookies['spotify_auth_state'] || null;

  if (!code) {
    console.error('Brak code w callbacku');
    return res.redirect('/?error=missing_code');
  }
  if (state !== storedState) {
    console.error('CSRF warning: state mismatch');
    return res.redirect('/?error=state_mismatch');
  }
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
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
      }
    );

    console.log('Spotify token response:', tokenRes.status, tokenRes.data);
    const { access_token, refresh_token } = tokenRes.data;

    // Zapisz tokeny w cookies zamiast wysyłania do webhooka
    saveTokensInCookies(res, { code, access_token, refresh_token });

    // Przekieruj z tokenem (frontend)
    res.redirect(`https://buzzy.bieda.it?token=${access_token}`);
  } catch (err) {
    console.error('Token request failed:', err.response?.status, err.response?.data || err.message);
    return res.redirect('/?error=token_request_failed');
  }
});

// Sprawdź stan autentykacji
app.get('/check-auth', (req, res) => {
  // Sprawdź czy mamy token w cookies
  const accessToken = req.cookies.spotify_access_token;
  
  res.json({
    authenticated: !!accessToken
  });
});

// Opcjonalnie: odświeżanie tokena
app.get('/refresh_token', async (req, res) => {
  const { refresh_token } = req.query;
  if (!refresh_token) {
    return res.status(400).json({ error: 'missing_refresh_token' });
  }

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token
  });

  try {
    const refreshRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      body.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
      }
    );
    console.log('Refresh token response:', refreshRes.status, refreshRes.data);
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
