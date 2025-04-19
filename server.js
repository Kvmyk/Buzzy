const express = require('express');
const request = require('request');
const querystring = require('querystring');
const cookieParser = require('cookie-parser'); // Dodane
const axios = require('axios');
require('dotenv').config();

const app = express();

// Ustawienia
const port = process.env.PORT || 3000;
const ipAddress = '2a01:4f9:2b:289c::130';
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'https://buzzy.bieda.it/callback';

// Middleware
app.use(cookieParser());
app.use(express.static('./'));

// 🔐 Generator losowego stringa (np. dla state)
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// 🔁 Wysyłka do webhooka (teraz obsługuje tokeny)
async function sendAuthCodeToWebhook(data) {
  try {
    const webhookUrl = 'https://n8nlink.bieda.it/webhook-test/778fa366-b202-4fc6-b763-e0619b1655b4';
    const response = await axios.post(webhookUrl, {
      ...data,
      timestamp: new Date().toISOString(),
      source: 'buzzy.bieda.it'
    });
    console.log('Webhook OK:', response.status);
    return true;
  } catch (error) {
    console.error('Webhook error:', error.message);
    if (error.response) {
      console.error('Webhook status:', error.response.status);
      console.error('Webhook data:', error.response.data);
    }
    return false;
  }
}

// 🌐 Strona główna
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// 🔑 Krok 1: Login – przekierowanie do Spotify
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie('spotify_auth_state', state);

  const scope = 'user-read-private user-read-email playlist-modify-private playlist-modify-public';

  res.redirect('https://accounts.spotify.com/authorize?' + querystring.stringify({
    response_type: 'code',
    client_id: client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state
  }));
});

// 🔁 Krok 2: Callback – odbiór kodu i zamiana na tokeny
app.get('/callback', (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

  if (!code) {
    console.error('Brak kodu autoryzacyjnego');
    return res.redirect('https://buzzy.bieda.it?error=missing_code');
  }

  if (state === null || state !== storedState) {
    console.error('Błąd CSRF – state mismatch');
    return res.redirect('https://buzzy.bieda.it?error=state_mismatch');
  }

  res.clearCookie('spotify_auth_state');

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    json: true
  };

  request.post(authOptions, async (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      const refresh_token = body.refresh_token;

      // Wysyłka danych do webhooka
      await sendAuthCodeToWebhook({ code, access_token, refresh_token });

      // Przekierowanie z tokenem
      res.redirect(`https://buzzy.bieda.it?token=${access_token}`);
    } else {
      console.error('Błąd autoryzacji Spotify:', error);
      res.redirect('https://buzzy.bieda.it?error=token_request_failed');
    }
  });
});

// 🚀 Start serwera
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});
