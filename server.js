require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static('./'));

// Zmienne konfiguracyjne Spotify
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'https://n8nlink.bieda.it/rest/oauth2-credential/callback';

// Endpointy API dla autentykacji Spotify

// Sprawdzanie statusu autentykacji
app.get('/api/spotify/check-auth', (req, res) => {
  const accessToken = req.cookies.spotify_access_token;
  
  if (!accessToken) {
    return res.status(401).json({ authenticated: false });
  }
  
  // Sprawdź czy token jest wciąż ważny poprzez zapytanie do API Spotify
  axios.get('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })
  .then(() => {
    res.json({ 
      authenticated: true,
      message: 'User authenticated with Spotify'
    });
  })
  .catch(() => {
    // Token wygasł lub jest nieprawidłowy
    res.status(401).json({ authenticated: false });
  });
});

// Obsługa callback po autoryzacji
app.post('/api/spotify/callback', async (req, res) => {
  const code = req.body.code;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    // Wymiana kodu na token dostępu
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET
        ).toString('base64')
      }
    });
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Ustaw ciasteczka
    res.cookie('spotify_access_token', access_token, {
      maxAge: expires_in * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.cookie('spotify_refresh_token', refresh_token, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dni
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error exchanging auth code:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to exchange authorization code',
      details: error.response?.data || error.message
    });
  }
});

// Wylogowanie
app.post('/api/spotify/logout', (req, res) => {
  res.clearCookie('spotify_access_token');
  res.clearCookie('spotify_refresh_token');
  res.json({ success: true });
});

// Pobieranie profilu użytkownika
app.get('/api/spotify/profile', async (req, res) => {
  const accessToken = req.cookies.spotify_access_token;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Spotify profile:', error.response?.data || error.message);
    res.status(401).json({ 
      error: 'Failed to fetch profile',
      details: error.response?.data || error.message 
    });
  }
});

// Uruchomienie serwera
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});