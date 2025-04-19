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
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://buzzy.bieda.it/callback';

// ——— Middleware ———
app.use(cookieParser());
app.use(express.static('.')); // serwuj pliki z głównego katalogu

// ——— Funkcja do generowania CSRF state ———
function generateRandomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// ——— Krok 1: przekierowanie do Spotify ———
app.get('/login', (req, res) => {
  const state = generateRandomString();
  const returnUrl = req.query.state || '/';
  
  // Zapisz stan i adres powrotu
  res.cookie('spotify_auth_state', state, { httpOnly: true, secure: true });
  res.cookie('return_url', returnUrl, { httpOnly: true, secure: true });
  
  const scope = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-modify-private'
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

// ——— Krok 2: Spotify callback ———
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies['spotify_auth_state'];
  const returnUrl = req.cookies['return_url'] || '/';

  if (!code || state !== storedState) {
    res.clearCookie('spotify_auth_state');
    res.clearCookie('return_url');
    return res.redirect('/?error=state_mismatch');
  }

  res.clearCookie('spotify_auth_state');
  res.clearCookie('return_url');
  
  const tokenData = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI
  });

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      tokenData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    
    // Przekazujemy token jako "token" żeby app.js mógł go łatwo odczytać
    res.redirect(`/?token=${access_token}&expires_in=${expires_in}`);
  } catch (err) {
    console.error('Token exchange error:', err.response?.data || err.message);
    res.redirect('/?error=token_failed');
  }
});

// ——— Start serwera ———
app.listen(PORT, IP_ADDRESS, () => {
  console.log(`Auth server listening on http://${IP_ADDRESS}:${PORT}`);
});
