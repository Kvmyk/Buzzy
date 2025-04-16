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

// Function to exchange auth code for tokens and send results to webhook
async function getSpotifyTokenAndSendToWebhook(code) {
  try {
    // Prepare token exchange with Spotify
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      }), 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
        }
      }
    );
    
    console.log('Token successfully retrieved from Spotify');
    
    // Forward the complete token response to webhook
    const webhookUrl = 'https://n8nlink.bieda.it/webhook-test/e289c41c-5e9a-4244-b769-85a46588dbb5';
    const webhookResponse = await axios.post(webhookUrl, tokenResponse.data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Complete token data forwarded to webhook, response:', webhookResponse.status);
    return tokenResponse.data;
  } catch (error) {
    console.error('Error during token exchange or webhook forwarding:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
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
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  console.log('Received authorization code:', code);
  
  try {
    // Get token and send to webhook
    const tokenData = await getSpotifyTokenAndSendToWebhook(code);
    
    if (tokenData && tokenData.access_token) {
      // Redirect to main domain with token
      res.redirect(`https://buzzy.bieda.it?token=${tokenData.access_token}`);
    } else {
      // Redirect without token if there was an error
      console.error('Failed to get access token');
      res.redirect(`https://buzzy.bieda.it`);
    }
  } catch (error) {
    console.error('Error in callback route:', error.message);
    res.redirect(`https://buzzy.bieda.it`);
  }
});

// Start the server
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});