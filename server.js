const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors({
    origin: true, // Lub określ konkretną domenę
    credentials: true
}));

// Serwowanie statycznych plików (frontend)
app.use(express.static(__dirname));

// Konfiguracja Spotify
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = 'https://n8nlink.bieda.it/rest/oauth2-credential/callback';

// Endpoint do wymienienia kodu autoryzacyjnego na token
app.post('/api/spotify/callback', async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({ error: 'Brak kodu autoryzacyjnego' });
        }
        
        // Przygotowanie danych do wymiany kodu na token
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('code', code);
        tokenParams.append('redirect_uri', SPOTIFY_REDIRECT_URI);
        
        // Wymiana kodu na token
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: tokenParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
            }
        });
        
        // Pobierz tokeny z odpowiedzi
        const { access_token, refresh_token, expires_in } = response.data;
        
        // Ustaw bezpieczne ciasteczka (niedostępne dla JavaScript)
        res.cookie('spotify_access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: expires_in * 1000, // w milisekundach
            sameSite: 'lax'
        });
        
        res.cookie('spotify_refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dni
            sameSite: 'lax'
        });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Błąd wymiany kodu:', error.response?.data || error.message);
        res.status(500).json({ error: 'Błąd podczas uwierzytelniania' });
    }
});

// Endpoint do sprawdzania ważności tokenu
app.get('/api/spotify/check-auth', async (req, res) => {
    const accessToken = req.cookies.spotify_access_token;
    const refreshToken = req.cookies.spotify_refresh_token;
    
    if (!accessToken) {
        if (refreshToken) {
            // Próba odświeżenia tokenu
            try {
                await refreshAccessToken(refreshToken, res);
                return res.status(200).json({ authenticated: true });
            } catch (error) {
                return res.status(401).json({ authenticated: false });
            }
        }
        return res.status(401).json({ authenticated: false });
    }
    
    // Sprawdzenie czy token jest ważny
    try {
        await axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        return res.status(200).json({ authenticated: true });
    } catch (error) {
        // Token wygasł, próba odświeżenia
        if (refreshToken) {
            try {
                await refreshAccessToken(refreshToken, res);
                return res.status(200).json({ authenticated: true });
            } catch (refreshError) {
                return res.status(401).json({ authenticated: false });
            }
        }
        
        return res.status(401).json({ authenticated: false });
    }
});

// Funkcja pomocnicza do odświeżania tokenu
async function refreshAccessToken(refreshToken, res) {
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'refresh_token');
    tokenParams.append('refresh_token', refreshToken);
    
    const response = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: tokenParams,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
    });
    
    const { access_token, expires_in } = response.data;
    
    // Aktualizacja tokenu dostępu
    res.cookie('spotify_access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: expires_in * 1000,
        sameSite: 'lax'
    });
    
    return access_token;
}

// Endpoint do wylogowywania
app.post('/api/spotify/logout', (req, res) => {
    res.clearCookie('spotify_access_token');
    res.clearCookie('spotify_refresh_token');
    res.status(200).json({ success: true });
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});