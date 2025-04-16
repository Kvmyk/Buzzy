const express = require('express');
const request = require('request');
const querystring = require('querystring');
require('dotenv').config();
const app = express();

const port = 3000;
const ipAddress = '2a01:4f9:2b:289c::130';

const client_id = process.env.CLIENT_ID; // Using environment variable
const client_secret = process.env.CLIENT_SECRET; // Using environment variable
const redirect_uri = 'http://buzzy.bieda.it/callback';

// Serve static files
app.use(express.static('./'));

// Root route: Redirect users to Spotify login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Step 1: Login route to redirect to Spotify
app.get('/login', (req, res) => {
  const scope = 'user-read-private user-read-email'; // Adjust scopes as needed
  const authUrl = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
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
      res.redirect(`http://buzzy.bieda.it?token=${access_token}`);
    } else {
      res.send('Error during authentication');
    }
  });
});

// Start the server
app.listen(port, ipAddress, () => {
  console.log(`Buzzy app running at http://[${ipAddress}]:${port}`);
});