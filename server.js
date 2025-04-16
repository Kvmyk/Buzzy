const express = require('express');
const axios = require('axios');
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
    res.json({ access_token: token });
  } catch (error) {
    console.error('Błąd podczas uzyskiwania tokena Spotify:', error.message);
    res.status(500).json({ error: 'Nie udało się uzyskać tokena Spotify' });
  }
});

app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});