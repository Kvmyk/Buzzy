const express = require('express');
const request = require('request');
const querystring = require('querystring');
require('dotenv').config();
const app = express();

// Use the PORT from environment variables
const port = process.env.PORT || 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

// Use the new environment variable names
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = 'https://buzzy.bieda.it/callback';
// Serve static files
app.use(express.static('./'));

// Root route: Redirect users to Spotify login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Step 1: Login route to redirect to Spotify
app.get('/login', (req, res) => {
  // Pobierz state z parametru URL (jeśli istnieje)
  const state = req.query.state || encodeURIComponent('https://buzzy.bieda.it');
  
  // Zakres uprawnień
  const scope = 'user-read-private user-read-email playlist-modify-private playlist-modify-public';
  
  // Dodaj parametr state do URL autoryzacji
  const authUrl = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state  // Przekazujemy oryginalny state
    });
    
  res.redirect(authUrl);
});

// Step 2: Callback route to handle Spotify's response
app.get('/callback', (req, res) => {
  const code = req.query.code || null;

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
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;

      // Step 3: Redirect back to the main page with the token
      res.redirect(`/?token=${access_token}`);
    } else {
      // Szczegółowe logowanie błędu
      console.error('Spotify authentication error:', error);
      console.error('Response status:', response ? response.statusCode : 'No response');
      console.error('Response body:', body);
      
      // Pokaż szczegóły błędu w odpowiedzi
      res.send(`Error during authentication: ${body ? JSON.stringify(body) : 'Unknown error'}`);
    }
  });
});

// Start the server
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});