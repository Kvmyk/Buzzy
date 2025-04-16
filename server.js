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
    const webhookUrl = 'https://n8nlink.bieda.it/webhook-test/e289c41c-5e9a-4244-b769-85a46588dbb5';
    
    // Zmieniono format danych, aby dokładnie pasował do komendy curl
    const response = await axios.post(webhookUrl, {
      code: code  // Zmieniono z auth_code na code
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Kod autoryzacyjny wysłany do webhooka, odpowiedź:', response.status);
    return true;
  } catch (error) {
    console.error('Błąd podczas wysyłania kodu do webhooka:', error.message);
    return false;
  }
}

// Funkcja do wysyłania danych do webhooka
async function sendAuthDataToWebhook(authData) {
  try {
    const webhookUrl = 'https://n8nlink.bieda.it/webhook-test/e289c41c-5e9a-4244-b769-85a46588dbb5';
    
    console.log('Próba wysłania danych do webhooka:', JSON.stringify({
      access_token: authData.access_token ? '[TOKEN UKRYTY]' : 'brak',
      refresh_token: authData.refresh_token ? '[TOKEN UKRYTY]' : 'brak',
      expires_in: authData.expires_in || 'brak',
      code: authData.code ? '[KOD UKRYTY]' : 'brak'
    }));
    
    // Wysyłaj wszystkie dostępne dane uwierzytelniające
    const response = await axios.post(webhookUrl, authData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Dane uwierzytelniające wysłane do webhooka:');
    console.log('- Status odpowiedzi:', response.status);
    console.log('- Nagłówki odpowiedzi:', response.headers);
    console.log('- Ciało odpowiedzi:', response.data);
    return true;
  } catch (error) {
    console.error('Błąd podczas wysyłania danych do webhooka:');
    console.error('- Komunikat błędu:', error.message);
    if (error.response) {
      console.error('- Status odpowiedzi:', error.response.status);
      console.error('- Nagłówki odpowiedzi:', error.response.headers);
      console.error('- Dane błędu:', error.response.data);
    }
    console.error('- Stack trace:', error.stack);
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
app.get('/callback', function(req, res) {
  const code = req.query.code || null;
  const state = req.query.state || null;
  
  console.log('=== OTRZYMANO CALLBACK OD SPOTIFY ===');
  console.log('- Kod autoryzacyjny otrzymany:', code ? 'Tak' : 'Nie');
  console.log('- State otrzymany:', state ? 'Tak' : 'Nie');

  if (state === null) {
    console.error('Błąd: Brak parametru state, możliwa próba CSRF');
    res.redirect('/#' + 
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    console.log('Przygotowywanie żądania wymiany kodu na token...');
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    console.log('Wysyłanie żądania do Spotify API: POST', authOptions.url);
    console.log('- redirect_uri:', redirect_uri);
    console.log('- grant_type:', authOptions.form.grant_type);

    // Make the request to exchange code for access token
    request.post(authOptions, function(error, response, body) {
      console.log('Otrzymano odpowiedź od Spotify API');
      
      if (!error && response && response.statusCode === 200) {
        const access_token = body.access_token;
        const refresh_token = body.refresh_token;
        const expires_in = body.expires_in;
        
        console.log('=== WYMIANA KODU NA TOKEN UDANA ===');
        console.log('- Access token otrzymany:', access_token ? 'Tak' : 'Nie');
        console.log('- Refresh token otrzymany:', refresh_token ? 'Tak' : 'Nie');
        console.log('- Expires in:', expires_in);

        // Wyślij wszystkie dane uwierzytelniające do webhooka
        console.log('Wysyłanie danych do webhooka...');
        sendAuthDataToWebhook({
          code: code,
          access_token: access_token,
          refresh_token: refresh_token,
          expires_in: expires_in
        }).then(success => {
          console.log('Webhook wysłany:', success ? 'Sukces' : 'Błąd');
          
          console.log('Przekierowywanie do głównej strony...');
          res.redirect('https://buzzy.bieda.it/');
        });
      } else {
        // Szczegółowe logowanie błędu
        console.error('=== BŁĄD WYMIANY KODU NA TOKEN ===');
        console.error('- Błąd:', error);
        console.error('- Status:', response ? response.statusCode : 'Brak odpowiedzi');
        console.error('- Body:', body);
        
        if (response) {
          console.error('- Nagłówki odpowiedzi:', response.headers);
        }
        
        console.log('Przekierowywanie do głównej strony (mimo błędu)...');
        res.redirect('https://buzzy.bieda.it/');
      }
    });
  }
});

// Start the server
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});