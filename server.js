const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Upewnij się, że zmienne środowiskowe są załadowane
const app = express();
const port = 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

const client_id = process.env.SPOTIFY_CLIENT_ID; // Pobierz z .env
const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Pobierz z .env

app.use(express.static('./'));

// Endpoint do uzyskania tokena Spotify
app.get('/spotify-auth', async (req, res) => {
  const authOptions = {
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  };

  try {
    const response = await axios(authOptions);
    const token = response.data.access_token;
    console.log('Token uzyskany pomyślnie:', token); // Logowanie tokena
    res.json({ access_token: token });
  } catch (error) {
    console.error('Błąd podczas uzyskiwania tokena Spotify:', error.response?.data || error.message);
    res.status(500).json({ error: 'Nie udało się uzyskać tokena Spotify' });
  }
});

// Endpoint do logowania użytkownika do Spotify
app.get('/spotify-login', (req, res) => {
  const scopes = encodeURIComponent('user-read-private user-read-email'); // Zakresy dostępu
  const redirect_uri = encodeURIComponent('https://n8nlink.bieda.it/callback'); // Zmieniono na nowy redirect URI
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${scopes}&redirect_uri=${redirect_uri}`;

  res.redirect(authUrl); // Przekierowanie użytkownika do Spotify
});

// Endpoint obsługujący callback
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;

  if (!code) {
    return res.status(400).json({ error: 'Brak kodu autoryzacyjnego' });
  }

  const authOptions = {
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'https://n8nlink.bieda.it/callback', // Zmieniono na nowy redirect URI
    }),
  };

  try {
    const response = await axios(authOptions);
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token;

    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error('Błąd podczas wymiany kodu na token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Nie udało się wymienić kodu na token' });
  }
});

app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});