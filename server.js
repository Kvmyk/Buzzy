const express = require('express');
const request = require('request');
const querystring = require('querystring');
require('dotenv').config();
const axios = require('axios'); // Dodaj na początku
const app = express();

// Use the PORT from environment variables
const port = process.env.PORT || 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

// Use the new environment variable names
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'https://buzzy.bieda.it/callback';

// Dodaj tę funkcję na początku pliku, po deklaracji zmiennych
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Funkcja do wysyłania kodu autoryzacyjnego do webhooka
async function sendAuthCodeToWebhook(code) {
  try {
    const webhookUrl = 'https://n8nlink.bieda.it/webhook-test/778fa366-b202-4fc6-b763-e0619b1655b4';
    
    const response = await axios.post(webhookUrl, {
      auth_code: code,
      timestamp: new Date().toISOString(),
      source: 'buzzy.bieda.it'
    });
    
    console.log('Kod autoryzacyjny wysłany do webhooka, odpowiedź:', response.status);
    return true;
  } catch (error) {
    console.error('Błąd podczas wysyłania kodu do webhooka:', error.message);
    return false;
  }
}

// Serve static files
app.use(express.static('./'));

// Root route: Serve the main page without automatic redirection
app.get('/', (req, res) => {
  // Po prostu serwuj stronę główną bez automatycznego przekierowania
  res.sendFile(__dirname + '/index.html');
});

// Step 1: Login route to redirect to Spotify
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'user-read-private user-read-email playlist-modify-private playlist-modify-public';

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

// Step 2: Callback route to handle Spotify's response
app.get('/callback', (req, res) => {
  const code = req.query.code || null;
  // Wyświetl kod w konsoli serwera
  console.log('Otrzymany kod autoryzacyjny:', code);
  
  // Wyślij kod do webhooka n8n
  sendAuthCodeToWebhook(code);
  
  // Sprawdź czy odpowiedź została już wysłana
  let responseSent = false;

  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code',
    },
    headers: {
      'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
    },
    json: true,
  };

  request.post(authOptions, (error, response, body) => {
    if (responseSent) return; // Nie wysyłaj odpowiedzi ponownie
    responseSent = true;
    
    if (!error && response && response.statusCode === 200) {
      const access_token = body.access_token;
      
      // Przekierowanie na główną domenę z tokenem
      res.redirect(`https://buzzy.bieda.it?token=${access_token}`);
    } else {
      // Szczegółowe logowanie błędu (tylko w konsoli)
      console.error('Spotify authentication error:', error);
      console.error('Response status:', response ? response.statusCode : 'No response');
      console.error('Response body:', body);
      
      // Tylko przekierowanie, bez wysyłania błędu
      res.redirect(`https://buzzy.bieda.it`);
    }
  });
});

// Start the server
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});