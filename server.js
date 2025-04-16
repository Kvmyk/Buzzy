const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Załaduj zmienne środowiskowe
const app = express();
const port = 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

const client_id = process.env.SPOTIFY_CLIENT_ID; // Pobierz z .env
const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Pobierz z .env
const redirect_uri = 'https://n8nlink.bieda.it/rest/oauth2-credential/callback'; // Stały redirect URI

// Endpoint do logowania użytkownika do Spotify
app.get('/', (req, res) => {
  const state = 'some_random_string'; // Możesz użyć generatora losowych ciągów
  const scopes = encodeURIComponent('user-read-private user-read-email');
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${client_id}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}`;
  res.redirect(authUrl);
});

// Endpoint obsługujący callback
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;

  if (!code) {
    return res.status(400).json({ error: 'Brak kodu autoryzacyjnego' });
  }

  if (!state || state !== 'some_random_string') {
    return res.status(400).json({ error: 'Nieprawidłowy parametr state' });
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
      redirect_uri: redirect_uri,
    }).toString(),
  };

  try {
    const response = await axios(authOptions);
    const access_token = response.data.access_token;
    const refresh_token = response.data.refresh_token;

    console.log('Access Token:', access_token);
    console.log('Refresh Token:', refresh_token);

    res.send('Zalogowano pomyślnie! Możesz teraz korzystać z aplikacji.');
  } catch (error) {
    console.error('Błąd podczas wymiany kodu na token:', error.response?.data || error.message);
    res.status(500).json({ error: 'Nie udało się wymienić kodu na token' });
  }
});

app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});